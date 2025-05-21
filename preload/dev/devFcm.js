const colors = require('colors');
const path = require('path');
const dotenv = require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { JWT } = require('google-auth-library');
const { initializeApp, applicationDefault } = require('firebase-admin/app');

const axiosInstance = require('../../services/axios');
const { logger } = require('../../services/logger');
const { connectDB, closeDB } = require('../../services/mongodb');
const { connectFirebase } = require('../../services/firebaseCloudMessage');
const { buildTransferMessage, buildQRPaymentMessage, buildMerchantQRPaymentMessage, buildVIPCommisionMessage, buildSpendingRewardMessage, sendMessage } = require('../../services/firebaseCloudMessage');

const Member = require('../../models/memberModel');
const CloudMessagingModel = require('../../models/cloudMessagingModel');

const send = async () => {
    try {
        // Connect to the database
        await connectDB();
        await connectFirebase();

        logger.info('🔄 Start send FCM');
        const recipient = await Member.findOne({ _id: '6755e6c06f1c6d3316c4ddd0' }, { _id: 1, userName: 1, fullName: 1 });
        if (!recipient) {
            logger.error(`❌ Recipient not found}`);
            return;
        }

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let message;
        let amount = 500;
        let receivingAmount = 450;
        message = buildTransferMessage(amount, recipient);
        await sendMessage(message, recipient);
        logger.info('Sent');
        await delay(2000);

        message = buildQRPaymentMessage(amount, recipient);
        await sendMessage(message, recipient);
        logger.info('Sent');
        await delay(2000);

        message = buildMerchantQRPaymentMessage(amount, receivingAmount, recipient);
        await sendMessage(message, recipient);
        logger.info('Sent');
        await delay(2000);

        message = buildVIPCommisionMessage(amount, recipient);
        await sendMessage(message, recipient);
        logger.info('Sent');
        await delay(2000);

        message = buildSpendingRewardMessage(amount);
        await sendMessage(message, recipient);
        logger.info('Sent');
        await delay(2000);

    } catch (error) {
        logger.error(`❌ Critical Error: ${error.message}`);
        await closeDB();
        process.exit(1);
    } finally {
        logger.info(`✅ Done`);
        await closeDB();
        process.exit(1);
    }
};

send();