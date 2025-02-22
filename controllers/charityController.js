const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

//const Charity = require('../models/charityModel');
const MasterCharity = require('../models/masterCharityModel');

//const getCharity = asyncHandler(async (req, res) => {
//    try {
//        const charity = await Charity.find({status: "Active"}, {_id: 0, __v: 0});
//        if (!charity) {
//            res.status(404);
//            throw new Error('No active charity found');
//        }
//
//        const totalDonationAmount = charity.reduce((total, item) => total + item.donationAmount, 0);
//
//        res.status(200).json({
//            charities: charity,
//            totalDonationAmount
//        });
//    } catch (error) {
//        res.status(500);
//        throw error;
//    }
//});

const getCharity = asyncHandler(async (req, res) => {
    try {
        const masterCharity = await MasterCharity.find({}, {_id: 0, __v: 0});
        if (!masterCharity) {
            res.status(404);
            throw new Error('No charity found');
        }

        const totalDonationAmount = masterCharity.reduce((total, item) => total + item.donationAmount, 0);

        res.status(200).json(masterCharity);
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const updateMasterCharity = async (charitableAmount) => {
    await MasterCharity.updateOne({}, {
        $inc: {
            donationAmount: charitableAmount,
            donationCount: 1
        }
    }, {upsert: true});
};

module.exports = {getCharity, updateMasterCharity};

