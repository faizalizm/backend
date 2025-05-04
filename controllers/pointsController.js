const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const getPoints = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find all transactions linked to the wallet
    logger.info('Fetching points history - Status : Success / In Progress, 90d Ago : ' + ninetyDaysAgo);
    const transactions = await Transaction.find({
        systemType: 'HubPoints',
        walletId: wallet._id,
        status: {$in: ['Success', 'In Progress']},
        createdAt: {$gte: ninetyDaysAgo}
    }, {
        systemType: 1,
        type: 1,
        description: 1,
        status: 1,
        amount: 1,
        createdAt: 1,
        shippingStatus: 1,
        shippingDetails: 1
    }).sort({createdAt: -1});

    res.status(200).json({
        points: wallet.points,
        transactions
    });
});

const redeemPoints = asyncHandler(async (req, res) => {
    const {points} = req.body;

    const minRedemptionAmount = 50;

    if (!points) {
        res.status(400);
        throw new Error('Please specify points to redeem');
    }

    if (points <= 0) {
        res.status(400);
        throw new Error('Invalid value of points to redeem');
    }

    logger.info(`Checking minimum redemption - Points : ${points}, Minimum redemption : ${minRedemptionAmount}`);
    if (points < minRedemptionAmount) {
        res.status(400);
        throw new Error(`Points must be at least ${minRedemptionAmount} to redeem`);
    }

    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({memberId: req.member._id}, {_id: 1, balance: 1, points: 1});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    logger.info(`Points available : ${wallet.points}, Points to redeem : ${points}`);

    // Check if wallet balance is sufficient for the withdrawal
    logger.info('Checking points balance');
    if (wallet.points < points) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient points to convert');
    }

    try {
        logger.info('Creating debit point transaction');
        const pointsTransaction = await Transaction.create({
                        walletId: wallet._id,
                        systemType: 'HubPoints',
                        type: 'Debit',
                        description: 'Points Redemption',
                        status: 'Success',
                        amount: points
                });

        logger.info('Creating credit cash transaction');
        const walletTransaction = await Transaction.create({
                        walletId: wallet._id,
                        systemType: 'HubWallet',
                        type: 'Credit',
                        description: 'Points Redemption',
                        status: 'Success',
                        amount: points
                });

        if (!pointsTransaction || !walletTransaction) {
            res.status(500);
            throw new Error('Failed to create transaction');
        }

        logger.info('Deducting points balance');
        wallet.points -= Number(points);

        logger.info('Adding cash balance');
        wallet.balance += Number(points);
        await wallet.save();


        res.status(200).json({
            points: wallet.points
        });
    } catch (error) {
        logger.error(`Error processing withdrawal : ${error.message}`);

        res.status(500);
        throw new Error('Withdrawal failed, please try again later');
    }
});

module.exports = {getPoints, redeemPoints};
