const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '.env')});
const colors = require('colors');

const axiosInstance = require('../services/axios');
const {logger} = require('../services/logger');
const {connectDB, closeDB} = require('../services/mongodb');

const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const Member = require('../models/memberModel');

const {processVIPCommision} = require('../controllers/commisionController');

const {TOYYIB_URL, TOYYIB_SECRET, TOYYIB_CALLBACK_URL, IP} = process.env;

const processTopup = async (memberId, walletId, amount) => {
    logger.info('Top Up transaction, updating wallet');

    const wallet = await Wallet.findOne({_id: walletId, memberId}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!wallet)
        throw new Error('Wallet Not Found');

    wallet.balance = (Number(wallet.balance)) + Number(amount);
    await wallet.save();

    logger.info(`Previous Wallet Balance: ${wallet.balance - amount}, Updated Wallet Balance: ${wallet.balance}`);
};

const processVIPPayment = async (memberId, amount) => {
    logger.info('VIP Payment, updating member status');

    const member = await Member.findOne({_id: memberId}).select('-paymentCode -createdAt -updatedAt -__v');
    if (!member)
        throw new Error('Member Not Found');

    member.type = 'VIP';
    member.vipAt = new Date();
    await member.save();

    logger.info(`⭐ Member ${member.fullName} upgraded to VIP`);

    // Process VIP Referral Commission
    await processVIPCommision(member, amount);
};

const processPayments = async () => {
    try {
        // Connect to the database
        await connectDB();

        logger.info('🔄 Start Cron Job - Payment Processing');
        const transactions = await Transaction.find({status: 'In Progress'});

        if (transactions.length === 0) {
            logger.info('⦰ No transactions to process.');
            logger.info('✅ End Cron Job - Payment Processing');
            await closeDB();
            process.exit(0); // Exit gracefully
        }

        for (const transaction of transactions) {
            try {
                // Find the wallet linked to the member
                const wallet = await Wallet.findOne({_id: transaction.walletId});
                if (!wallet) {
                    logger.info(`❌ Wallet not found for transaction ${transaction.billCode}`);
                    continue;
                }


                // Ensure the member exists
                const memberExist = await Member.findOne({_id: wallet.memberId});
                if (!memberExist) {
                    logger.info(`❌ Member not found for wallet ${wallet._id}`);
                    continue;
                }

                const response = await axiosInstance.post(
                        `${TOYYIB_URL}/index.php/api/getBillTransactions`,
                        new URLSearchParams({
                            userSecretKey: TOYYIB_SECRET,
                            billCode: transaction.billCode
                        }),
                        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
                );

                const billStatus = response.data;
                logger.info(`📊 Bill Status Response for ${transaction.billCode}:`, billStatus);

                if (billStatus[0]?.billpaymentStatus === '1') {
                    logger.info(`✅ Transaction ${transaction.billCode} has been paid.`);


                    if (transaction.status === 'In Progress') {
                        transaction.status = 'Success';
                        await transaction.save();
                        logger.info(`✅ Transaction updated to Success`);

                        if (transaction.type === "Top Up") {
                            await processTopup(wallet.memberId, wallet._id, transaction.amount);
                        } else if (transaction.type === "VIP Payment") {
                            await processVIPPayment(wallet.memberId, transaction.amount);
                        } else {
                            logger.error(`⚠️ Unknown payment type for ${transaction.billCode}.`);
                        }
                    } else {
                        logger.info(`❌ Transaction In Progress was updated beforehand, will skip to process`);
                    }
                } else if (billStatus[0]?.billpaymentStatus === '3') {
                    logger.info(`❌ Transaction ${transaction.billCode} has failed.`);

                    if (transaction.status === 'In Progress') {
                        transaction.status = 'Failed';
                        await transaction.save();
                    }
                } else {
                    logger.info(`⏳ Transaction ${transaction.billCode} still in progress.`);
                }
            } catch (error) {
                logger.error(`❌ Error processing transaction ${transaction.billCode}:`, error.message);
            }
        }

        logger.info('✅ End Cron Job - Payment Processing');
        await closeDB();
        process.exit(0); // Exit gracefully
    } catch (error) {
        logger.error('❌ Critical Error:', error.message);
        await closeDB();
        process.exit(1);
    }
};

processPayments();