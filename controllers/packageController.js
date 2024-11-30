const moment = require('moment-timezone');
const axiosInstance = require('../services/axios');
const asyncHandler = require('express-async-handler');
const Package = require('../models/packageModel');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const getPackage = asyncHandler(async (req, res) => {
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

//    const package = await Package.find({type: 'VIP'}).select('-_id -createdAt -updatedAt -__v');
    const package = await Package.find().select('-_id -createdAt -updatedAt -__v');

    if (package.length > 0) {
        res.json(package);
    } else {
        res.status(404);
        throw new Error('No Package Available');
    }
});

const purchasePackage = asyncHandler(async (req, res) => {
    const {code} = req.body;

    console.log(req.member.type)
    if (req.member.type === "VIP") {
        res.status(400);
        throw new Error('Member is already a VIP');
    }

    if (!code) {
        res.status(400);
        throw new Error('Package code is required');
    }
    
    const package = await Package.findOne({code, type: 'VIP'});
    if (!package) {
        res.status(404);
        throw new Error('Package Not Found');
    }

    // Find the wallet linked to the member
    const wallet = await Wallet.findOne({memberId: req.member._id});
    if (!wallet) {
        res.status(404);
        throw new Error('Wallet Not Found');
    }

    console.log(`Wallet Balance: ${wallet.balance}, Package Price: ${package.price}`);

    // Check if wallet balance is sufficient for the package
    if (wallet.balance < package.price) {
        res.status(402); // HTTP 402: Payment Required
        throw new Error('Insufficient funds. Please top up your account.');
    }

    wallet.balance -= package.price;
    await wallet.save();

    req.member.type = 'VIP';
    await req.member.save();

    res.status(200).json({
        message: 'Package purchased successfully. You have upgraded to VIP!',
        remainingBalance: wallet.balance,
        memberType: req.member.type
    });
});

module.exports = {getPackage, purchasePackage};