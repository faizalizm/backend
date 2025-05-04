const crypto = require('crypto');
const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Charity = require('../models/charityModel');
const Package = require('../models/packageModel');
const Member = require('../models/memberModel');
const Merchant = require('../models/merchantModel');

const getConfiguration = asyncHandler(async (req, res) => {

    logger.info('Fetching system app version details');
    const appVerLatest = process.env.APP_VER_LATEST;
    const appVerMin = process.env.APP_VER_MIN;

    logger.info('Fetching charity checksum');
    const charities = await Charity.find(
            {status: 'Active'}
    ).sort('_id');

    const charityChecksum = crypto.createHash('sha256').update(JSON.stringify(charities)).digest('hex');

    logger.info('Fetching system package checksum');
    const packages = await Package.find(
            {
                type: 'VIP',
                status: {$ne: 'Inactive'}
            },
            {_id: 1, picture: 1, type: 1, name: 1, description: 1, price: 1, code: 1}
    ).sort('_id');

    const packageChecksum = crypto.createHash('sha256').update(JSON.stringify(packages)).digest('hex');

    logger.info('Fetching system advertisement checksum');
    // TODO

    logger.info('Fetching personal profile checksum');
    const profile = await Member.findById(req.member._id,
            {password: 0, referrals: 0, __v: 0}
    ).sort('_id');
    const profileChecksum = crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex');

    logger.info('Fetching personal merchant checksum');
    const merchant = await Merchant.findOne({memberId: req.member._id},
            {memberId: 0, spendingCode: 0, __v: 0}
    ).sort('_id');

    const merchantChecksum = crypto.createHash('sha256').update(JSON.stringify(merchant)).digest('hex');

    res.status(200).json({
        app: {
            appVerLatest,
            appVerMin
        },
        systemChecksum: {
            charity: charityChecksum,
            package: packageChecksum
        },
        personalChecksum: {
            profile: profileChecksum,
            merchant: merchantChecksum
        }

    });
});

module.exports = {getConfiguration};