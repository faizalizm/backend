const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Member = require('../models/memberModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const getPoints = asyncHandler(async (req, res) => {
    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    logger.info('Ninety Days Ago: ' + ninetyDaysAgo);

    // Find all transactions linked to the wallet
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

    res.json({
        points: wallet.points,
        transactions
    });
});

module.exports = {getPoints};
