const asyncHandler = require('express-async-handler');

const { startManagedSession } = require('../services/mongodb');
const { logger } = require('../services/logger');

const PointsReward = require('../models/pointsRewardModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const Logistic = require('../models/logisticModel');

const { sendShipmentNotification } = require('../utility/mailBuilder.js');

const getPointsReward = asyncHandler(async (req, res) => {

    logger.info('Fetching points reward details - Status : Active');
    const now = new Date();

    const pointsReward = await PointsReward.find({
        status: "Active",
        $and: [
            {
                $or: [
                    { startDate: null },
                    { startDate: { $lte: now } }
                ]
            },
            {
                $or: [
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }
        ]
    }, {
        __v: 0
    }).sort({ priority: 1 });

    if (!pointsReward) {
        res.status(404);
        throw new Error('No active points reward found');
    }

    const formattedPointsReward = pointsReward.map(item => {
        return {
            ...item.toJSON(),
            pointsRequirement: item.pointsRequirement + ' pts'
        };
    });

    res.status(200).json({
        pointsReward: formattedPointsReward
    });
});

const getPoints = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id });
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
        status: { $in: ['Success', 'In Progress'] },
        createdAt: { $gte: ninetyDaysAgo }
    }, {
        systemType: 1,
        type: 1,
        description: 1,
        status: 1,
        amount: 1,
        createdAt: 1,
        shippingStatus: 1,
        shippingDetails: 1
    }).sort({ createdAt: -1 });

    res.status(200).json({
        points: wallet.points,
        transactions // TODO : remove
    });
});

const getPointHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 5 } = req.query;

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Find the wallet linked to the member
    logger.info('Fetching wallet details');
    const wallet = await Wallet.findOne({ memberId: req.member._id });
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Find all transactions linked to the wallet
    logger.info('Fetching points history - Status : Success');
    const transactions = await Transaction.find({
        systemType: 'HubPoints',
        walletId: wallet._id,
        status: { $in: ['Success'] },
    }, {
        systemType: 1,
        type: 1,
        description: 1,
        status: 1,
        amount: 1,
        createdAt: 1,
    }).sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    if (transactions.length > 0) {
        res.status(200).json({
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
            }
        });
    } else {
        res.status(404);
        throw new Error('No transaction found');
    }
});

const redeemPoints = asyncHandler(async (req, res) => {
    const { points } = req.body;

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
    const wallet = await Wallet.findOne({ memberId: req.member._id }, { _id: 1, balance: 1, points: 1 });
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

const claimReward = asyncHandler(async (req, res) => {
    const { pointsRewardId } = req.body;

    if (!pointsRewardId) {
        res.status(400);
        throw new Error('Points Reward ID is required');
    }

    const session = await startManagedSession();
    try {
        logger.info('Checking member shipping details');
        if (!req.member.shippingDetails) {
            res.status(400);
            throw new Error('Please fill up shipping details');
        }

        logger.info('Fetching points reward details');
        const pointRewards = await PointsReward.findById(pointsRewardId, { __v: 0 }, { session });

        if (!pointRewards) {
            logger.warn('Points reward not found');
            res.status(404);
            throw new Error('Points reward not found');
        }

        if (pointRewards.status !== 'Active') {
            logger.warn('Points reward is not active');
            res.status(404);
            throw new Error('Points reward not active');
        }


        // Check points reward availability
        logger.info('Validating points reward availability');
        const now = new Date();
        if (pointRewards.startDate && now < pointRewards.startDate) {
            res.status(400);
            throw new Error('Points reward is not available yet');
        }
        if (pointRewards.endDate && now > pointRewards.endDate) {
            res.status(400);
            throw new Error('Points reward is no longer available');
        }

        // Find the wallet linked to the member
        logger.info('Fetching wallet details');
        const wallet = await Wallet.findOne({ memberId: req.member._id }, { _id: 1, balance: 1, points: 1 }, { session });
        if (!wallet) {
            res.status(404);
            throw new Error('Wallet Not Found');
        }

        logger.info(`Points available : ${wallet.points}, Claim Requirements : ${pointRewards.pointsRequirement}`);

        // Check if wallet balance is sufficient for the withdrawal
        logger.info('Checking points balance');
        if (wallet.points < pointRewards.pointsRequirement) {
            res.status(402); // HTTP 402: Payment Required
            throw new Error('Insufficient points to convert');
        }

        logger.info('Creating debit point transaction');
        const pointsTransaction = await Transaction.create([{
            walletId: wallet._id,
            systemType: 'HubPoints',
            type: 'Debit',
            description: `Claim Reward: ${pointRewards.title}`,
            status: 'Success',
            amount: pointRewards.pointsRequirement
        }], { session });

        logger.info('Creating logistic tracking');
        const logisticTracking = await Logistic.create([{
            transactionId: pointsTransaction._id,
            systemType: 'Points Reward',
            description: `${pointRewards.title}`,
            pointsRewardId: pointRewards._id,
            status: 'Preparing',
            shippingDetails: req.member.shippingDetails,
        }], { session });
        logger.info(`Logistic tracking created: ${logisticTracking._id}`);

        logger.info('Deducting points balance');
        wallet.points -= Number(pointRewards.pointsRequirement);
        await wallet.save({ session });

        // Send shipment notification
        logger.info('Sending shipping notification via email');
        sendShipmentNotification(req.member, pointsTransaction);

        await session.commitTransaction();
        res.status(200).json({
            message: 'Points reward successfully claimed. You will receive updates on the shipment soon!',
        });
    } catch (error) {
        await session.abortTransaction();
        throw error;

    } finally {
        session.endSession();
    }
});

module.exports = { getPointsReward, getPoints, getPointHistory, redeemPoints, claimReward };
