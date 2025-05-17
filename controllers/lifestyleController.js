const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

const Lifestyle = require('../models/lifestyleModel');

const getLifestyle = asyncHandler(async (req, res) => {

    logger.info('Fetching lifestyle details - Status : Active');
    const lifestyles = await Lifestyle.find({ status: "Active" }, { _id: 0, __v: 0, startDate: 0, endDate: 0 });
    if (!lifestyles) {
        res.status(404);
        throw new Error('No active lifestyle found');
    }

    res.status(200).json({
        lifestyles
    });
});

module.exports = { getLifestyle };
