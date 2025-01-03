const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Charity = require('../models/charityModel');

const getCharity = asyncHandler(async (req, res) => {
    const charity = await Charity.find({status: "Active"}, {_id: 0, __v: 0});
    if (!charity) {
        res.status(404);
        throw new Error('No active charity found');
    }

    res.json(charity);
});

module.exports = {getCharity};

