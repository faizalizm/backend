const asyncHandler = require('express-async-handler');
const moment = require('moment-timezone');

const {logger} = require('../services/logger');
const axiosInstance = require('../services/axios');
const {getCategoryToyyib, createBillToyyib, getBillTransactionsToyyib} = require('../services/toyyibpay');

const Package = require('../models/packageModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const getPackage = asyncHandler(async (req, res) => {
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    const package = await Package.find({type: 'VIP'}).select('-categoryCode -packageCharge -emailContent -_id -createdAt -updatedAt -__v');

    if (package.length > 0) {
        res.json(package);
    } else {
        res.status(404);
        throw new Error('No Package Available');
    }
});

const processVIPCommision = async (member, amount) => {
    logger.info(`Processing VIP Referral Commision`);

    // Percentages for each level
    const percentages = [20, 2, 2, 2, 1.2, 1.2, 0.8, 0.8, 0.4, 0.4, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    logger.info(percentages.length);

    let currentMember = member.referredBy;
    let level = 0;

    const visited = new Set();

    try {
        while (currentMember && level < 20) {
            if (visited.has(currentMember)) {
                logger.info('Cycle detected in referral chain. Breaking loop.');
                break;
            }
            visited.add(currentMember);

            // Find the upline member
            const uplineMember = await Member.findOne({referralCode: currentMember}).select('_id fullName referralCode referredBy type');
            if (!uplineMember)
                break;

            // Calculate the commission for this level
            const percentage = percentages[level] ?? 0; // If percentage not specied, then 0 commission
            const commission = (amount * percentage) / 100;


            if (uplineMember.type !== 'VIP' && level < 3) {
                logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) missed on receiving ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
            } else {
                const uplineWallet = await Wallet.findOne({memberId: uplineMember._id}).select('balance');
                if (!uplineWallet) {
                    logger.info(`Wallet not found for upline member ${uplineMember.fullName}`);
                } else {
                    uplineWallet.balance = Number(uplineWallet.balance) + commission;
                    await uplineWallet.save();

                    await Transaction.create({
                        walletId: uplineWallet._id,
                        systemType: 'HubWallet',
                        type: 'Credit',
                        description: 'VIP Registration Commission',
                        status: 'Success',
                        memberId: member._id,
                        amount: amount
                    });

                    logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) received ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
                }
            }

            // Move to the next upline
            currentMember = uplineMember.referredBy;
            level++;
        }
    } catch (error) {
        logger.error(`Error processing VIP commission at Level ${level + 1}: ${error.message}`);
        logger.error(error.stack);
    }
};

const purchasePackage = asyncHandler(async (req, res) => {
    const {code, paymentChannel} = req.body;

    if (!paymentChannel) { // To determine payment method
        res.status(400);
        throw new Error('Package Channel is required');
    } else if (!code) { // To determine which VIP package
        res.status(400);
        throw new Error('Package code is required');
    }

    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    const package = await Package.findOne({code, type: 'VIP'});
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }


    if (paymentChannel === 'HubWallet') {

        logger.info(`Wallet Balance: ${wallet.balance}, Package Price: ${package.price}`);

        // Check if wallet balance is sufficient for the package
        if (wallet.balance < package.price) {
            res.status(402); // HTTP 402: Payment Required
            throw new Error('Insufficient funds. Please top up your account.');
        }

        wallet.balance -= package.price;
        await wallet.save();

        req.member.type = 'VIP';
        req.member.vipAt = new Date();
        await req.member.save();

        // Create Transaction
        const transaction = await Transaction.create({
            walletId: wallet._id,
            systemType: 'HubWallet',
            type: 'Debit',
            description: 'VIP Payment',
            status: 'Success',
            packageCode: code,
            amount: package.price
        });

        // Process VIP Referral Commission
        processVIPCommision(req.member._id, package.price);

        res.status(200).json({
            message: 'Package purchased successfully. You have upgraded to VIP!',
            remainingBalance: wallet.balance,
            memberType: req.member.type
        });

    } else if (paymentChannel === 'FPX') {

        const getCategory = await getCategoryToyyib(req, res, package.categoryCode);

        try {
            const billExpiryDate = moment().tz('Asia/Kuala_Lumpur').add(5, 'minutes').format('DD-MM-YYYY HH:mm:ss');

            // Create Transaction
            const transaction = await Transaction.create({
                walletId: wallet._id,
                systemType: 'FPX',
                type: 'N/A',
                description: 'VIP Payment',
                status: 'In Progress',
                packageCode: code,
                amount: package.price
            });

            if (!transaction) {
                res.status(500);
                throw new Error('Failed to create transaction, please try again later');
            }

            const createBill = await createBillToyyib(req, res, package.price, package, getCategory, billExpiryDate);
            const billCode = createBill.data[0].BillCode;
            const paymentUrl = process.env.TOYYIB_URL + '/' + billCode;

            // Update the transaction to include the BillCode
            await Transaction.findByIdAndUpdate(transaction._id, {billCode}, {new : true});

            // Query to ToyyibPay
            getBillTransactionsToyyib(req.member._id, wallet, package.price, billCode, "VIP Payment");

            // Return the response to the client
            res.status(200).json({paymentUrl, paymentExpiry: billExpiryDate});

        } catch (error) {
            res.status(500);
            logger.info(error.stack);
            throw new Error('VIP payment failed, please try again later');
        }


    } else {
        res.status(404);
        throw new Error('Payment channel not available');
    }

});

module.exports = {getPackage, purchasePackage, processVIPCommision};