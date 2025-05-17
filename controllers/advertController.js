const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

const Advert = require('../models/advertModel');

const getAdvert = asyncHandler(async (req, res) => {

    logger.info('Fetching advert details - Status : Active');
    const now = new Date();

    const adverts = await Advert.find({
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

    if (!adverts) {
        res.status(404);
        throw new Error('No active advert found');
    }

    res.status(200).json({
        adverts
    });
});

module.exports = { getAdvert };
