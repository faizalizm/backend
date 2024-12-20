const {logger} = require('../services/logger');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const processVIPCommision = async (member, amount) => {
    logger.info(`Processing VIP Referral Commision`);

    // Percentages for each level
    const percentages = [20, 2, 2, 2, 1.2, 1.2, 0.8, 0.8, 0.4, 0.4, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];

    let currentMember = member.referredBy;
    let level = 0;

    const visited = new Set();

    try {
        while (currentMember && level < 20) {
            logger.info(`Level ${level + 1}`);
            if (visited.has(currentMember)) {
                logger.info('Cycle detected in referral chain. Breaking loop.');
                break;
            }
            visited.add(currentMember);

            // Find the upline member
            const uplineMember = await Member.findOne({_id: currentMember}).select('_id fullName referralCode referredBy type');

            if (!uplineMember)
                break;

            // Calculate the commission for this level
            const percentage = percentages[level] ?? 0; // If percentage not specied, then 0 commission
            const commission = (amount * percentage) / 100;

            if (uplineMember.type !== 'VIP') { //  && level < 3 (commented this for spending reward)
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
                        amount: commission
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


//const processSpendingReward = async (spenderWallet, member, amount) => {
//    logger.info(`Processing Spending Rewards`);
//    
//    const spenderPercentages = 10;
//    const spenderReward = (amount * percentage) / 100;
//
//    spenderWallet.balance = Number(spenderWallet.balance) + spenderReward;
//    await spenderWallet.save();
//
//    await Transaction.create({
//        walletId: spenderWallet._id,
//        systemType: 'HubPoints',
//        type: 'Credit',
//        description: 'Spending Rewards',
//        status: 'Success',
//        memberId: member._id,
//        amount: 
//    });
//
//
//    // Percentages for each level
//    const percentages = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
//    logger.info(percentages.length);
//
//    let currentMember = member.referredBy;
//    let level = 0;
//
//    const visited = new Set();
//
//    try {
//        while (currentMember && level < 20) {
//            if (visited.has(currentMember)) {
//                logger.info('Cycle detected in referral chain. Breaking loop.');
//                break;
//            }
//            visited.add(currentMember);
//
//            // Find the upline member
//            const uplineMember = await Member.findOne({referralCode: currentMember}).select('_id fullName referralCode referredBy type');
//            if (!uplineMember)
//                break;
//
//            // Calculate the commission for this level
//            const percentage = percentages[level] ?? 0; // If percentage not specied, then 0 commission
//            const commission = (amount * percentage) / 100;
//
//
//            if (uplineMember.type !== 'VIP' && level < 3) {
//                logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) missed on receiving ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
//            } else {
//                const uplineWallet = await Wallet.findOne({memberId: uplineMember._id}).select('balance');
//                if (!uplineWallet) {
//                    logger.info(`Wallet not found for upline member ${uplineMember.fullName}`);
//                } else {
//                    uplineWallet.balance = Number(uplineWallet.balance) + commission;
//                    await uplineWallet.save();
//
//                    await Transaction.create({
//                        walletId: uplineWallet._id,
//                        systemType: 'HubWallet',
//                        type: 'Credit',
//                        description: 'VIP Registration Commission',
//                        status: 'Success',
//                        memberId: member._id,
//                        amount: amount
//                    });
//
//                    logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) received ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
//                }
//            }
//
//            // Move to the next upline
//            currentMember = uplineMember.referredBy;
//            level++;
//        }
//    } catch (error) {
//        logger.error(`Error processing VIP commission at Level ${level + 1}: ${error.message}`);
//        logger.error(error.stack);
//    }
//};

module.exports = {processVIPCommision};