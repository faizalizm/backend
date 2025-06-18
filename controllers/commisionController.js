const { logger } = require('../services/logger');
const { buildSpendingRewardMessage, buildVIPCommisionMessage, sendMessage } = require('../services/firebaseCloudMessage');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const MasterCharity = require('../models/masterCharityModel');
const MasterMdr = require('../models/masterMdrModel');

const processVIPCommision = async (member, amount) => {
    logger.info(`Processing VIP Referral Commision`);

    // Percentages for each level (pass-up concept)
    // const percentages = [20, 2, 2, 2, 1.2, 1.2, 0.8, 0.8, 0.4, 0.4, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    const percentages = [20, 7.5, 2.5, 1.25, 1.25, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25];

    logger.info('Commision to calculate from RM 400');
    amount = 40000;

    let currentMember = member.referredBy;
    let level = 0;
    let payoutLevel = 0;

    const visited = new Set();

    try {
        while (currentMember && level < 20) {
            logger.info(`Level ${level + 1}`);
            logger.info(`Payout Level ${payoutLevel + 1}`);

            if (visited.has(currentMember)) {
                logger.info('Cycle detected in referral chain. Breaking loop.');
                break;
            }
            visited.add(currentMember);

            // Find the upline member
            const uplineMember = await Member.findOne({ _id: currentMember }).select('_id fullName referralCode referredBy type');
            if (!uplineMember)
                break;

            // Calculate the commission for this payoutLevel
            const percentage = percentages[payoutLevel] ?? 0; // If percentage not specied, then 0 commission
            const commission = (amount * percentage) / 100;
            logger.info(`Commision : RM ${(commission / 100)}`);

            if (commission / 100 < 0.01) {
                logger.info(`Commision RM ${(commission / 100)} too small to distribute to ${uplineMember.fullName} (Level ${level + 1})`);

                // Move to the next upline
                currentMember = uplineMember.referredBy;
                level++;
                continue;
            } else if (uplineMember.type !== 'VIP') { //  && level < 3 (commented this for spending reward)
                logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) missed on receiving ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
            } else {
                const uplineWallet = await Wallet.findOne({ memberId: uplineMember._id }).select('balance');
                if (!uplineWallet) {
                    logger.error(`Wallet not found for upline member ${uplineMember.fullName}`);
                } else {
                    uplineWallet.balance = Number(uplineWallet.balance) + commission;
                    await uplineWallet.save();

                    logger.info('Creating credit transaction');
                    await Transaction.create({
                        walletId: uplineWallet._id,
                        systemType: 'HubWallet',
                        type: 'Credit',
                        description: 'VIP Registration Commission',
                        status: 'Success',
                        memberId: member._id,
                        amount: commission
                    });

                    // Send FCM
                    const message = buildVIPCommisionMessage(commission, member);
                    sendMessage(message, uplineMember);

                    logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) received ${percentage}% (RM ${(commission / 100).toFixed(2)})`);

                    // payoutLevel increases only when a VIP receives commission
                    logger.info('Bonus will be passed up');
                    payoutLevel++;

                    // ✅ UPDATE STATS 
                    const statsLevel = level + 1;
                    const stat = uplineMember.referralStats.find(s => s.level === statsLevel);

                    if (stat) {
                        stat.vip += 1;
                    } else {
                        uplineMember.referralStats.push({
                            level: statsLevel,
                            vip: 1,
                            user: 0
                        });
                    }

                    await uplineMember.save();
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

const processSpendingReward = async (spenderWallet, member, cashbackRate, amount) => {
    logger.info(`Processing Spending Rewards`);

    const spenderPercentages = cashbackRate * 50 / 100;
    const charitablePercentages = cashbackRate * 2 / 100;
    const mdrPercentages = cashbackRate * 6 / 100;

    const spenderReward = amount * spenderPercentages / 100;
    const charitableContribution = amount * charitablePercentages / 100;
    const mdrAmount = amount * mdrPercentages / 100;

    logger.info(`Amount : ${amount}, Cashback Rate : ${cashbackRate}`);
    logger.info(`Spender Cashback : ${spenderReward}, Charitable Contribution : ${charitableContribution}, MDR : ${mdrAmount}`);
    spenderWallet.points = Number(spenderWallet.points) + spenderReward;
    await spenderWallet.save();

    await Transaction.create({
        walletId: spenderWallet._id,
        systemType: 'HubPoints',
        type: 'Credit',
        description: 'Spending Rewards',
        status: 'Success',
        memberId: member._id,
        amount: spenderReward,
        charitableContribution,
        mdrAmount
    });

    // add to charity - increase charity and count
    updateMasterCharity(charitableContribution);

    // add to mdr - increase amount
    updateMasterMdr(mdrAmount);

    // Percentages for each level
    const percentages = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]; // total up to 40%

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
            const uplineMember = await Member.findOne({ _id: currentMember }).select('_id fullName referralCode referredBy type');
            if (!uplineMember)
                break;

            // Calculate the commission for this level
            const percentage = percentages[level] ?? 0; // If percentage not specied, then 0 commission
            const commission = amount * (cashbackRate / 100) * (percentage / 100);
            logger.info(`Commision : RM ${(commission / 100)}`);

            if (commission / 100 < 0.01) {
                logger.info(`Commision RM ${(commission / 100)} too small to distribute to ${uplineMember.fullName} (Level ${level + 1})`);

                // Move to the next upline
                currentMember = uplineMember.referredBy;
                level++;
                continue;
            } else if (uplineMember.type !== 'VIP' && level >= 3) {
                logger.info(`Upline Member ${uplineMember.fullName} (Level ${level + 1}) missed on receiving ${percentage}% (RM ${(commission / 100).toFixed(2)})`);
            } else {
                const uplineWallet = await Wallet.findOne({ memberId: uplineMember._id }).select('balance');
                if (!uplineWallet) {
                    logger.error(`Wallet not found for upline member ${uplineMember.fullName}`);
                } else {
                    uplineWallet.balance = Number(uplineWallet.balance) + commission;
                    await uplineWallet.save();

                    logger.info('Creating credit transaction');
                    await Transaction.create({
                        walletId: uplineWallet._id,
                        systemType: 'HubWallet',
                        type: 'Credit',
                        description: 'Spending Rewards Commision',
                        status: 'Success',
                        memberId: member._id,
                        amount: commission
                    });

                    // Send FCM
                    const message = buildSpendingRewardMessage(commission);
                    sendMessage(message, uplineMember);

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

const updateMasterCharity = async (charitableAmount) => {
    await MasterCharity.updateOne({}, {
        $inc: {
            donationAmount: charitableAmount,
            donationCount: 1
        }
    }, { upsert: true });
};

const updateMasterMdr = async (mdrAmount) => {
    await MasterMdr.updateOne({}, {
        $inc: { mdrAmount }
    }, { upsert: true });
};

module.exports = { processVIPCommision, processSpendingReward };