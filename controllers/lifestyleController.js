const asyncHandler = require('express-async-handler');

const { startManagedSession } = require('../services/mongodb');
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

        // Todo : Check if member has previously claimed

        // Check if member met the requirements
        const allRequirementsMet = lifestyleRewards.requirement.every(requirements => {
            const level = requirements.level;
            const requiredVip = requirements.vipRequired;

            // Find member's referral stats for this level
            const stat = req.member.referralStats.find(s => s.level === level);
            const vipCount = stat?.vip || 0;

            logger.info(`Level ${level} - Required VIP: ${requiredVip}, Member VIP: ${vipCount}`);

            return vipCount >= requiredVip;
        });
        if (!allRequirementsMet) {
            res.status(400);
            throw new Error('VIP requirements has not been met');
        }

        logger.info('Creating logistic tracking');
        const logisticTracking = await Logistic.create([{
            systemType: 'Lifestyle Reward',
            description: `${lifestyleRewards.title}`,
            pointsRewardId: lifestyleRewards._id,
            status: 'Preparing',
            shippingDetails: req.member.shippingDetails,
        }], { session });
        logger.info(`Logistic tracking created: ${logisticTracking._id}`);

        // Send shipment notification
        logger.info('Sending shipping notification via email');
        sendShipmentNotification(req.member, lifestyleTransaction);

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
