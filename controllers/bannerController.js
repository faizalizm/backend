const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

const Banner = require('../models/bannerModel');

const getBanner = asyncHandler(async (req, res) => {

    logger.info('Fetching banner details - Status : Active');
    const now = new Date();

    const banners = await Banner.find({
        status: "Active",
        $and: [
            {
                $or: [
                    { startDate: null },
                    { startDate: { $lte: now } }
                ]
            },
            {
                $or: [
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }
        ]
    }, {
        _id: 0,
        __v: 0
    }).sort({ priority: 1 });

    if (!banners) {
        res.status(404);
        throw new Error('No active banner found');
    }

    res.status(200).json({
        banners
    });
});

module.exports = { getBanner };
