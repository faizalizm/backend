const colors = require('colors');
const { JWT } = require('google-auth-library');
const { initializeApp, applicationDefault } = require('firebase-admin/app');

const axiosInstance = require('./axios');
const { logger, trimBase64 } = require('./logger');

const CloudMessagingModel = require('../models/cloudMessagingModel');

const serviceAccount = require("../firebase-service-account.json");

const { FCM_URL } = process.env;

const connectFirebase = async () => {
    try {
        initializeApp({
            credential: applicationDefault(),
            projectId: 'backend-dc59e'
        });

        console.log(`Firebase Connected`.cyan.underline);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const getAccessToken = async () => {
    const jwtClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });

    try {
        const tokens = await jwtClient.authorize();
        return tokens.access_token;
    } catch (err) {
        logger.error('Error obtaining access token:', err);
    }
};

const setTokenOnLogin = async (member, token) => {
    try {
        // Check if the token already exists (possibly linked to another user)
        const existingToken = await CloudMessagingModel.findOne({ token });

        if (existingToken) {
            if (existingToken.memberId.toString() === member._id.toString()) {
                // Token already exists for the same user → No action needed
                logger.info(`FCM token already exists for user ${member._id}, skipping update.`);
                return;
            }

            // Token exists for another user → Reassign it
            await CloudMessagingModel.deleteOne({ token });
            logger.info(`FCM token reassigned from user ${existingToken.memberId} to user ${member._id}`);
        }

        // Remove old tokens for this user (to enforce one token per account)
        await CloudMessagingModel.deleteMany({ memberId: member._id });

        // Create new token record
        const tokenRecord = await CloudMessagingModel.create({
            memberId: member._id,
            token: token
        });

        logger.info('FCM token record added');
    } catch (error) {
        logger.error('FCM token record failed to be added:', error);
    }
};

const buildTransferMessage = (amount, member) => {
    const displayName = member?.userName?.trim() || member?.fullName?.trim();

    return {
        notification: {
            title: 'Received Transfer',
            body: `You have received RM ${(amount / 100).toFixed(2)} in your Hub Wallet${displayName ? ' from ' + displayName : ''}`
        },
        data: {
            sound: 'default'
        }
    };
};

const buildQRPaymentMessage = (amount, member) => {
    const displayName = member?.userName?.trim() || member?.fullName?.trim();

    return {
        notification: {
            title: 'Received QR Transfer',
            body: `You have received RM ${(amount / 100).toFixed(2)} in your Hub Wallet${displayName ? ' from ' + displayName : ''}`
        },
        data: {
            sound: 'default'
        }
    };
};

const buildMerchantQRPaymentMessage = (amount, receivingAmount, member) => {
    const displayName = member?.userName?.trim() || member?.fullName?.trim();

    return {
        notification: {
            title: 'Received Merchant QR Payment',
            body: `${displayName ? displayName : 'A customer'} has made a payment of RM ${(amount / 100).toFixed(2)}. You have received RM ${(receivingAmount / 100).toFixed(2)} in your Hub Wallet`
        },
        data: {
            sound: 'default'
        }
    };
};

const buildVIPCommisionMessage = (amount, vip) => {
    const displayName = vip?.userName?.trim() || vip?.fullName?.trim() || 'A member under you';

    return {
        notification: {
            title: 'Received VIP Commision',
            body: `${displayName} has upgraded to VIP. You have received RM ${(amount / 100).toFixed(2)} in your Hub Wallet`
        },
        data: {
            sound: 'default'
        }
    };
};

const buildSpendingRewardMessage = (amount) => {
    return {
        notification: {
            title: 'Received Spending Rewards',
            body: `Your downline has made a purchase. You have received RM ${(amount / 100).toFixed(2)} in your Hub Wallet`
        },
        data: {
            sound: 'default'
        }
    };
};

const sendMessage = async (message, member) => {

    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            logger.error('Failed to retrieve access token');
            return;
        }
        logger.info(`Access Token : ${accessToken}`);

        const cloudMessageRecord = await CloudMessagingModel.findOne({ memberId: member._id }, { token: 1, lastSent: 1 });
        if (!cloudMessageRecord || !cloudMessageRecord.token) {
            logger.warn(`No token associated with member ${member._id}`);
            return;
        }
        message.token = cloudMessageRecord.token;

        const response = await axiosInstance.post(
            FCM_URL,
            { message },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        await CloudMessagingModel.updateOne(
            { memberId: member._id },
            { $set: { lastSent: new Date() } }
        );

        logger.info(`✅ Message sent successfully to ${member._id}`, response.data);
        return response.data;

    } catch (error) {
        logger.error('Failed sending FCM message:', error);
    }
};

module.exports = {
    connectFirebase, getAccessToken, setTokenOnLogin,
    buildTransferMessage, buildQRPaymentMessage, buildMerchantQRPaymentMessage, buildVIPCommisionMessage, buildSpendingRewardMessage,
    sendMessage
};