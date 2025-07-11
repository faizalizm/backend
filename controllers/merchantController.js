const crypto = require('crypto');
const asyncHandler = require('express-async-handler');

const { generateUniqueId } = require('../services/mongodb');
const { logger } = require('../services/logger');
const { resizeImage } = require('../services/sharp');

const Member = require('../models/memberModel');
const Merchant = require('../models/merchantModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const Configuration = require('../models/configurationModel');

const { processSpendingReward } = require('../controllers/commisionController');
const { buildMerchantQRPaymentMessage, sendMessage } = require('../services/firebaseCloudMessage');

const { verifyPIN, handleIncorrectPIN, isWalletLocked, requirePin } = require('../utility/walletUtility');

const searchMerchant = asyncHandler(async (req, res) => {
    const { field, term, search, page = 1, limit = 5 } = req.query;

    const filter = {
        status: 'Active' // Only include active merchants
    };

    // Optional field-based search
    if (field && term) {
        // if (!allowedFields.includes(field)) {
        //     res.status(400);
        //     throw new Error('Search criteria not valid');
        // }
        filter[field] = { $regex: term, $options: 'i' };
    }
    // General search across multiple fields
    if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        filter.$or = [
            { name: searchRegex },
            { city: searchRegex },
            { state: searchRegex },
        ];
    }

    logger.info(`Setting filter: ${JSON.stringify(filter)}`);

    // Get the list of valid fields dynamically from the schema
    const validFields = Object.keys(Merchant.schema.paths).filter(
        (fieldName) =>
            fieldName !== '_id' &&
            fieldName !== 'memberId' &&
            fieldName !== 'logo' &&
            fieldName !== 'spendingCode'
    );

    // Check if the provided field is valid
    logger.info('Checking if field is allowed');
    if (field && !validFields.includes(field)) {
        res.status(400);
        throw new Error('Invalid search field');
    }

    try {
        logger.info(`Fetching merchants - Field : ${field}, Term : ${term}, Page : ${page}, Limit : ${limit}`);
        // Fetch one extra to detect if there's a next page
        const skip = (Number(page) - 1) * Number(limit);
        const merchants = await Merchant.find(filter, { _id: 0, memberId: 0, spendingCode: 0 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Merchant.countDocuments(filter);

        const formattedMerchants = await Promise.all(merchants.map(async merchant => {
            let resizedPicture = null;
            logger.info('Resizing merchant logo');
            if (merchant.logo) {
                resizedPicture = await resizeImage(merchant.logo, process.env.IMAGE_WIDTH_MERCHANT_LIST, process.env.IMAGE_QUALITY_MERCHANT_LIST);
            }

            return {
                logo: resizedPicture,
                name: merchant.name,
                phone: merchant.phone,
                description: merchant.description,
                bizType: merchant.bizType,
                operatingDays: merchant.operatingDays,
                openingTime: merchant.openingTime,
                closingTime: merchant.closingTime,
                cashbackRate: merchant.cashbackRate,
                addressLine1: merchant.addressLine1,
                addressLine2: merchant.addressLine2,
                addressLine3: merchant.addressLine3,
                city: merchant.city,
                state: merchant.state,
                postCode: merchant.postCode,
                country: merchant.country,
                createdAt: merchant.createdAt,
                updatedAt: merchant.updatedAt
            };
        }));

        if (merchants.length > 0) {
            res.status(200).json({
                merchants: formattedMerchants,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.max(1, Math.ceil(total / limit))
                }
            });
        } else {
            res.status(404);
            throw new Error('No merchant found');
        }
    } catch (error) {
        res.status(500);
        throw new Error(error.message || 'Error searching merchants');
    }
});

const getMerchant = asyncHandler(async (req, res) => {
    logger.info('Fetching merchant details');
    const merchant = await Merchant.findOne({ memberId: req.member._id }, { _id: 0, memberId: 0, spendingCode: 0, __v: 0 });

    if (!merchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }

    logger.info(`Merchant - ${merchant.name}`);
    res.status(200).json(merchant);
});

const registerMerchant = asyncHandler(async (req, res) => {
    logger.info('Fetching merchant details');
    const existingMerchant = await Merchant.findOne({ memberId: req.member._id }, { _id: 1 });
    if (existingMerchant) {
        res.status(400);
        throw new Error('Merchant already registered');
    }

    // Generate Spending Code
    logger.info('Generating spending code');
    let isSpendingCodeUnique = false;
    let spendingCode;
    while (!isSpendingCodeUnique) {
        spendingCode = "spend://" + generateSpendingCode(); // Generate new spending code

        // Check if the spending code already exists in the database
        const existingSpendingCode = await Merchant.findOne(
            { spendingCode },
            { _id: 1 }
        );
        if (!existingSpendingCode) {
            isSpendingCodeUnique = true; // If no existing merchant found, the code is unique
        }
    }

    try {
        logger.info('Creating merchant');
        const merchant = await Merchant.create({
            ...req.body,
            spendingCode,
            memberId: req.member._id
        });

        res.status(200).json(merchant);
    } catch (error) {
        res.status(400);
        throw new Error(error);
    }
});

const updateMerchant = asyncHandler(async (req, res) => {
    // Remove restricted fields
    const { _id, memberId, createdAt, updatedAt, spendingCode, ...updates } = req.body;

    // Find merchant
    logger.info('Fetching merchant details');
    const merchant = await Merchant.findOne({ memberId: req.member._id },
        { spendingCode: 0 }
    );
    if (!merchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }

    // Update merchant
    try {
        logger.info('Updating merchant details');
        const updatedMerchant = await Merchant.findByIdAndUpdate(merchant._id, updates, {
            new: true,
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
    const { spendingCode, amount, walletPin } = req.body;

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

    if (!req.member.userName && !req.member.fullName) {
        logger.warn('Sender has not set username or fullname');
        res.status(400);
        throw new Error('You have not completed your profile');
    }

    logger.info(`Fetching sender details`);
    const senderMerchant = await Merchant.findOne({ memberId: req.member._id }, { _id: 1, memberId: 1, spendingCode: 1 });

    logger.info('Fetching sender wallet details');
    const senderWallet = await Wallet.findOne({ memberId: req.member._id });
    if (!senderWallet) {
        res.status(404);
        throw new Error('Sender wallet not found');
    }

    // Check if wallet balance is sufficient for the qr payment
    logger.info(`Checking wallet balance - Sender balance : RM ${senderWallet.balance / 100}, Transfer amount : RM ${amount / 100}`);
    if (senderWallet.balance < amount) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds');
    }


    logger.info('Fetching configuration');
    const configurations = await Configuration.getSingleton();
    if (!configurations) {
        res.status(500);
        throw new Error('Configuration not found');
    }

    // PIN lockout check
    if (isWalletLocked(senderWallet, configurations)) {
        res.status(403);
        throw new Error('PIN has been locked due to multiple failed attempts. Please contact support.');
    }
    if (requirePin(senderWallet, configurations, amount)) {
        logger.info('Transaction requires PIN');
        if (!senderWallet.pin) {
            res.status(403);
            throw new Error('Transaction above limit, please set up your pin');
        }
        if (!walletPin) {
            res.status(403);
            throw new Error('Enter your wallet PIN');
        }

        const isPINValid = await verifyPIN(walletPin, senderWallet.pin);
        if (!isPINValid) {
            // Security violation
            res.status(403);
            return await handleIncorrectPIN({
                wallet: senderWallet,
                configurations,
                member: req.member
            });
        }
    }

    logger.info('Fetching merchant details');
    const recipientMerchant = await Merchant.findOne({ spendingCode }, { _id: 1, memberId: 1, spendingCode: 1, cashbackRate: 1, status: 1 });
    if (!recipientMerchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }
    logger.info(`Merchant : ${recipientMerchant.name}, Status : ${recipientMerchant.status}`);
    if (recipientMerchant.status !== 'Active') {
        res.status(404);
        throw new Error('Merchant account deactivated');
    }

    logger.info('Fetching member details');
    let recipientMember = await Member.findById(recipientMerchant.memberId, { _id: 1, userName: 1, fullName: 1 });
    if (!recipientMember) {
        res.status(404);
        throw new Error('Member not found');
    }

    if (!recipientMember.userName && !recipientMember.fullName) {
        logger.warn('Merchant has not set username or fullname');
        res.status(400);
        throw new Error('Merchant has not completed their profile');
    }

    const recipientDisplayName = recipientMember.userName || recipientMember.fullName;
    const senderDescription = `Merchant QR Payment to ${recipientDisplayName}`;

    const senderDisplayName = req.member.userName || req.member.fullName;
    const recipientDescription = `Received Merchant QR Payment from ${senderDisplayName}`;

    const recipientWallet = await Wallet.findOne({ memberId: recipientMerchant.memberId });
    if (!recipientWallet) {
        res.status(404);
        throw new Error('Merchant not found');
    } else if (senderMerchant && spendingCode.trim() === senderMerchant.spendingCode) {
        res.status(400);
        throw new Error('Could not transfer to your own account');
    }

    logger.info('Creating sender debit transaction');
    const senderTransaction = await Transaction.create({
        referenceNumber: generateUniqueId('RH-MQR'),
        walletId: senderWallet._id,
        systemType: 'HubWallet',
        type: 'Debit',
        description: senderDescription,
        status: 'Success',
        counterpartyWalletId: recipientWallet._id,
        amount: amount
    });

    const cashbackAmount = amount * recipientMerchant.cashbackRate / 100;
    const receivingAmount = amount - (cashbackAmount);
    logger.info(`Cashback rate : ${recipientMerchant.cashbackRate} %, Cashback amount: RM ${cashbackAmount / 100}`);
    logger.info(`Merchant balance : RM ${recipientWallet.balance / 100}, Receiving amount: RM ${receivingAmount / 100}`);

    logger.info('Creating merchant credit transaction');
    const recipientTransaction = await Transaction.create({
        referenceNumber: generateUniqueId('RH-MQR'),
        walletId: recipientWallet._id,
        systemType: 'HubWallet',
        type: 'Credit',
        description: recipientDescription,
        status: 'Success',
        counterpartyWalletId: senderWallet._id,
        amount: receivingAmount
    });

    if (senderTransaction && recipientTransaction) {

        logger.info('Deducting sender wallet balance');
        senderWallet.balance -= Number(amount);
        await senderWallet.save();

        logger.info('Adding merchant wallet balance');
        recipientWallet.balance += Number(receivingAmount);
        await recipientWallet.save();

        logger.info(`New sender balance: ${senderWallet.balance}`);
        logger.info(`New merchant balance: ${recipientWallet.balance}`);

        // Send FCM
        logger.info('Notifying merchant via FCM');
        const message = buildMerchantQRPaymentMessage(amount, receivingAmount, req.member);
        sendMessage(message, recipientMember);

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
    logger.info('Fetching merchant details');
    const merchant = await Merchant.findOne({ memberId: req.member._id }, { _id: 0, name: 1, spendingCode: 1, cashbackRate: 1 });
    if (!merchant) {
        res.status(404);
        throw new Error('Merchant not found');
    }
    logger.info(`Merchant - ${merchant.name}`);

    res.status(200).json(merchant);
});

// Generate Payment Code
const generateSpendingCode = () => {
    const length = 64;
    const randomString = crypto.randomBytes(length).toString('base64').slice(0, length); // Generate a 64-character base64 string
    return randomString.replace(/\+/g, '0').replace(/\//g, '1'); // Replace unsafe characters to avoid issues
};

module.exports = { searchMerchant, getMerchant, registerMerchant, updateMerchant, qrSpending, genQRCode };