const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

const Lifestyle = require('../models/lifestyleModel');

const getLifestyle = asyncHandler(async (req, res) => {

    logger.info('Fetching lifestyle details - Status : Active');
    const now = new Date();

    const lifestyles = await Lifestyle.find({
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

    if (!lifestyles) {
        res.status(404);
        throw new Error('No active lifestyle found');
    }

    res.status(200).json({
        lifestyles
    });
});

module.exports = { getLifestyle };
