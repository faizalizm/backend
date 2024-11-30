const asyncHandler = require('express-async-handler');
const Wallet = require('../models/walletModel');

const getWallet = asyncHandler(async (req, res) => {
    const {email, password, phone} = req.body;

    // Check user email/phone
    let wallet = await Wallet.findOne(req.walletId).select('-id');

    if (wallet) {
        res.json(wallet);
    } else {
        res.status(400);
        throw new Error('No Wallet Available');
    }
});

const topupWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

const withdrawWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

const transferWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

const spendWallet = asyncHandler(async (req, res) => {
    res.status(404);
    throw new Error('No Yet Ready');
});

module.exports = {getWallet, topupWallet, withdrawWallet, transferWallet, spendWallet};