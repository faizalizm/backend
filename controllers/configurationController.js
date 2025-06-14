const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

const Configuration = require('../models/configurationModel');

const getConfiguration = asyncHandler(async (req, res) => {

    logger.info('Fetching configuration');
    const configurations = await Configuration.find({}, { _id: 0, createdAt: 0});

    // logger.info('Fetching personal profile checksum');
    // const profile = await Member.findById(req.member._id,
    //         {password: 0, referrals: 0, __v: 0}
    // ).sort('_id');
    // const profileChecksum = crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex');

    // logger.info('Fetching personal merchant checksum');
    // const merchant = await Merchant.findOne({memberId: req.member._id},
    //         {memberId: 0, spendingCode: 0, __v: 0}
    // ).sort('_id');

    // const merchantChecksum = crypto.createHash('sha256').update(JSON.stringify(merchant)).digest('hex');

    res.status(200).json({
        configurations
    });
});

module.exports = { getConfiguration };