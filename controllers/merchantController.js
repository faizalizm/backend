const crypto = require('crypto');
const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Member = require('../models/memberModel');
const Merchant = require('../models/merchantModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const {processSpendingReward} = require('../controllers/commisionController');

const searchMerchant = asyncHandler(async (req, res) => {
    const {field, term, page, limit} = req.query;

    if (!field || !term) {
        res.status(400);
        throw new Error('Please add field and term');
    }

    // Get the list of valid fields dynamically from the schema
    const validFields = Object.keys(Merchant.schema.paths).filter(
            (fieldName) =>
        fieldName !== '_id' &&
                fieldName !== 'memberId' &&
                fieldName !== 'logo' &&
                fieldName !== 'spendingCode'
    );

    // Check if the provided field is valid
    if (!validFields.includes(field)) {
        res.status(400);
        throw new Error('Invalid search field');
    }

    try {
        const searchQuery = {
            [field]: {$regex: term, $options: 'i'}
        };

        // Perform the search
        let merchants;
        let hasNextPage;
//        if (!page && !limit) {
            merchants = await Merchant.find(searchQuery, {_id: 0, memberId: 0, spendingCode: 0});
//        } else {
//            // Fetch one extra to detect if there's a next page
//            const skip = (parseInt(page) - 1) * parseInt(limit);
//            const result = await Merchant.find(searchQuery, {_id: 0, memberId: 0, spendingCode: 0})
//                    .skip(skip)
//                    .limit(parseInt(limit) + 1);
//
//            hasNextPage = result.length > limit;
//            merchants = hasNextPage ? result.slice(0, limit) : result;
//        }

        if (merchants.length > 0) {
//            if (!page && !limit) {
                res.status(200).json(merchants);
//            } else {
//                res.status(200).json({
//                    page: parseInt(page),
//                    pageSize: parseInt(limit),
//                    hasNextPage,
//                    merchants
//                });
//            }
        } else {
            res.status(404);
            throw new Error('No Merchant Found');
        }
    } catch (error) {
        res.status(500);
        throw new Error(error.message || 'Error searching merchants');
    }
});

const getMerchant = asyncHandler(async (req, res) => {
    const merchant = await Merchant.findOne({memberId: req.member._id}, {_id: 0, memberId: 0, spendingCode: 0, __v: 0});

    if (merchant) {
        res.status(200).json(merchant);
    } else {
        res.status(404);
        throw new Error('Merchant not found');
    }
});

const registerMerchant = asyncHandler(async (req, res) => {
    const existingMerchant = await Merchant.findOne({memberId: req.member._id}, {_id: 1});
    if (existingMerchant) {
        res.status(400);
        throw new Error('Merchant already registered');
    }

    // Generate Spending Code
    let isSpendingCodeUnique = false;
    let spendingCode;
    while (!isSpendingCodeUnique) {
        spendingCode = "spend://" + generateSpendingCode(); // Generate new spending code

        // Check if the spending code already exists in the database
        const existingSpendingCode = await Merchant.findOne(
                {spendingCode},
                {_id: 1}
        );
        if (!existingSpendingCode) {
            isSpendingCodeUnique = true; // If no existing merchant found, the code is unique
        }
    }

    try {
        const merchantData = {...req.body, spendingCode, memberId: req.member._id};
        const merchant = await Merchant.create(merchantData);

        res.status(200).json(merchant);
    } catch (error) {
        res.status(400);
        throw new Error(error);
    }
});

const updateMerchant = asyncHandler(async (req, res) => {
    // Remove restricted fields
    const {_id, memberId, createdAt, updatedAt, spendingCode, ...updates} = req.body;

    // Find merchant
    const merchant = await Merchant.findOne({memberId: req.member._id},
            {spendingCode: 0}
    );
    if (!merchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }

    // Update merchant
    try {
        const updatedMerchant = await Merchant.findByIdAndUpdate(merchant._id, updates, {
            new : true,
            runValidators: true // Ensures schema validation is applied
        });

        // Echo updated fields only
        const updatedFields = Object.keys(updates).reduce((acc, key) => {
            if (updatedMerchant[key] !== undefined) {
                acc[key] = updatedMerchant[key];
            }
            return acc;
        }, {});

        res.status(200).json(updatedFields);
    } catch (error) {
        res.status(400);
        throw new Error(error);
    }
});

const qrSpending = asyncHandler(async (req, res) => {
    const {spendingCode, amount} = req.body;

    if (!spendingCode) {
        res.status(400);
        throw new Error('QR Spending Code is required');
    } else if (!amount) {
        res.status(400);
        throw new Error('Amount is required');
    }

    if (!spendingCode.startsWith('spend://')) {
        res.status(400);
        throw new Error('QR code is not valid');
    }

    const senderMerchant = await Merchant.findOne({memberId: req.member._id}, {_id: 1, memberId: 1, spendingCode: 1});

    const senderWallet = await Wallet.findOne({memberId: req.member._id});
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender Wallet Not Found');
    }

    // Check if wallet balance is sufficient for the qr payment
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }

    const recipientMerchant = await Merchant.findOne({spendingCode}, {_id: 1, memberId: 1, spendingCode: 1, cashbackRate: 1});
    if (!recipientMerchant) {
        res.status(404);
        throw new Error('Merchant Not Found');
    }

    const recipientWallet = await Wallet.findOne({memberId: recipientMerchant.memberId});
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Recipient Not Found');
    } else if (senderMerchant && spendingCode.trim() === senderMerchant.spendingCode) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    const description = 'Merchant QR Payment';

    const senderTransaction = await Transaction.create({
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    const receivingAmount = amount - (amount * recipientMerchant.cashbackRate / 100);
    const recipientTransaction = await Transaction.create({
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: receivingAmount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info(`Sender Balance: ${senderWallet.balance}, Transfer Amount: ${amount}`);
        logger.info(`Recipient Balance: ${recipientWallet.balance}, Cashback Rate : ${recipientMerchant.cashbackRate}, Receiving Amount: ${receivingAmount}`);

        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        recipientWallet.balance += Number(receivingAmount);
        await recipientWallet.save();

        logger.info(`New Sender Balance: ${senderWallet.balance}`);
        logger.info(`New Recipient Balance: ${recipientWallet.balance}`);

        // Process spending reward (Asynchronously)
        processSpendingReward(senderWallet, req.member, recipientMerchant.cashbackRate, amount);

        res.status(200).json({
            balance: senderWallet.balance,
            currency: senderWallet.currency
        });
    } else {
        res.status(500);
        throw new Error('Transfer failed, please try again later');
    }
});

const genQRCode = asyncHandler(async (req, res) => {
    // Find the merchant linked to the member
    const merchant = await Merchant.findOne({memberId: req.member._id}, {_id: 0, name: 1, spendingCode: 1, cashbackRate: 1});
    if (!merchant) {
        res.status(404);
        throw new Error('Merchant Not Found');
    }

    try {
        res.status(200).json(merchant);
    } catch (error) {
        res.status(500).json({message: 'Error generating QR code', error: error.message});
    }
});

// Generate Payment Code
const generateSpendingCode = () => {
    const length = 64;
    const randomString = crypto.randomBytes(length).toString('base64').slice(0, length); // Generate a 64-character base64 string
    return randomString.replace(/\+/g, '0').replace(/\//g, '1'); // Replace unsafe characters to avoid issues
};

module.exports = {searchMerchant, getMerchant, registerMerchant, updateMerchant, qrSpending, genQRCode};