const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

const {logger} = require('../services/logger');

const Member = require('../models/memberModel');

const protect = asyncHandler(async (req, res, next) => {
    logger.info('Authenticating member');

    let token;

    if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
            ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find member
            const member = await Member.findById(decoded.id).select('-profilePicture -password -referrals');

            if (!member) {
                res.status(401);
                throw new Error('Member not found');
            }

            // Attach the member to the request object
            req.member = member;

            next();
        } catch (error) {
            logger.info(error);
            res.status(401);
            throw new Error('Authorization failed');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No token provided');
    }
});

module.exports = {protect};