const asyncHandler = require('express-async-handler');

const { startManagedSession, generateUniqueId } = require('../services/mongodb');
const { logger } = require('../services/logger');

const LifestyleReward = require('../models/lifestyleModel');
const Logistic = require('../models/logisticModel');

const { sendShipmentNotification } = require('../utility/mailBuilder.js');

const getLifestyle = asyncHandler(async (req, res) => {

    logger.info('Fetching lifestyle details - Status : Active');
    const now = new Date();

    const lifestyleRewards = await LifestyleReward.find({
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

    if (!lifestyleRewards) {
        res.status(404);
        throw new Error('No active lifestyle found');
    }

    const formattedLifestyles = lifestyleRewards.map(item => {
        return {
            ...item.toJSON(),
            requirement: item.requirement + ' VIP'
        };
    });

    res.status(200).json({
        lifestyles: formattedLifestyles
    });
});


const claimReward = asyncHandler(async (req, res) => {
    const { lifestyleRewardId } = req.body;

    if (!lifestyleRewardId) {
        res.status(400);
        throw new Error('Lifestyle Reward ID is required');
    }

    const session = await startManagedSession();
    try {
        logger.info('Checking member shipping details');
        if (!req.member.shippingDetails) {
            res.status(400);
            throw new Error('Please fill up shipping details');
        }

        logger.info('Fetching lifestyle reward details');
        const lifestyleRewards = await LifestyleReward.findById(lifestyleRewardId, { __v: 0 }, { session });

        if (!lifestyleRewards) {
            logger.warn('Lifestyle reward not found');
            res.status(404);
            throw new Error('Lifestyle reward not found');
        }

        if (lifestyleRewards.status !== 'Active') {
            logger.warn('Lifestyle reward is not active');
            res.status(404);
            throw new Error('Lifestyle reward not active');
        }

        // Check lifestyle reward availability
        logger.info('Validating lifestyle reward availability');
        const now = new Date();
        if (lifestyleRewards.startDate && now < lifestyleRewards.startDate) {
            res.status(400);
            throw new Error('Lifestyle reward is not available yet');
        }
        if (lifestyleRewards.endDate && now > lifestyleRewards.endDate) {
            res.status(400);
            throw new Error('Lifestyle reward is no longer available');
        }

        const previousLogistics = await Logistic.findOne({
            memberId: req.member._id,
            lifestyleRewardId: lifestyleRewards._id
        }, null, { session });

        if (previousLogistics) {
            res.status(409); // Conflict
            throw new Error('You have already claimed this lifestyle reward');
        }

        // Check if member met the requirements
        const directVip = req.member.referralStats?.find(stat => stat.level === 1)?.vip || 0;
        logger.info(`Direct VIP : ${directVip}, Claim Requirements : ${lifestyleRewards.requirement}`);
        if (directVip < lifestyleRewards.requirement) {
            res.status(400);
            throw new Error(`VIP requirements has not been met. You are at ${directVip}/${lifestyleRewards.requirement} VIP`);
        }

        logger.info('Creating logistic tracking');
        const [logisticTracking] = await Logistic.create([{
            referenceNumber: generateUniqueId('RH-LSR'),
            memberId: req.member._id,
            systemType: 'Lifestyle Reward',
            description: `1x ${lifestyleRewards.title}`,
            lifestyleRewardId: lifestyleRewards._id,
            shippingDetails: req.member.shippingDetails,
            statusHistory: [{
                status: 'Preparing',
                updatedAt: new Date(),
                updatedBy: req.member._id
            }]
        }], { session });
        logger.info(`Logistic tracking created: ${logisticTracking._id}`);

        // Send shipment notification
        logger.info('Sending shipping notification via email');
        const value = `${lifestyleRewards.requirement} VIP Members`;
        await sendShipmentNotification(req.member, logisticTracking.toJSON(), value);

        await session.commitTransaction();
        res.status(200).json({
            message: 'Lifestyle reward successfully claimed. You will receive updates on the shipment soon!',
        });
    } catch (error) {
        await session.abortTransaction();
        throw error;

    } finally {
        session.endSession();
    }
});

module.exports = { getLifestyle, claimReward };
