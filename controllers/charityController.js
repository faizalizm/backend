const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');
const {resizeImage} = require('../services/sharp');

const Charity = require('../models/charityModel');
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
        logger.info('Fetching Master Charity');
        const masterCharity = await MasterCharity.findOne({}, {_id: 0, __v: 0});
        if (!masterCharity) {
            res.status(404);
            throw new Error('No charity found');
        }

        res.status(200).json(masterCharity);
    } catch (error) {
        res.status(500);
        throw error;
    }
});

const getCharityGallery = asyncHandler(async (req, res) => {
    try {
        logger.info('Fetching Charity Gallery - Status : Active');
        const charities = await Charity.find({status: "Active"}, {_id: 0, __v: 0});
        if (!charities) {
            res.status(404);
            throw new Error('No active charity found');
        }

        logger.info('Resizing charity gallery picture');
        for (const charity of charities) {
            if (charity.picture) {
                charity.picture = await resizeImage(charity.picture, process.env.IMAGE_WIDTH_CHARITY_LIST, process.env.IMAGE_QUALITY_CHARITY_LIST);
            }
        }

        const totalDonationAmount = charities.reduce((total, item) => total + item.donationAmount, 0);

        res.status(200).json({
            charities,
            totalDonationAmount
        });
    } catch (error) {
        res.status(500);
        throw error;
    }
});

module.exports = {getCharity, getCharityGallery};

