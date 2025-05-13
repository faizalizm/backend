const jwt = require('jsonwebtoken');
const { TokenExpiredError } = jwt;
const asyncHandler = require('express-async-handler');

const { logger } = require('../services/logger');

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
            const member = await Member.findById(
                { _id: decoded.id, isDeleted: { $ne: true } },
                {
                    _id: 1,
                    'profilePicture': 0,
                    'password': 0,
                    'referrals': 0
                }
            );
            if (!member) {
                logger.warn('Member not found');
                throw new Error('Invalid credentials');
            } else if (member.status === 'Deleted') {
                throw new Error('Member not found');
            } else if (member.status === 'Deactivated') {
                throw new Error('Account deactivated, please contact support for assistance');
            }

            logger.info(`Member : ${member.fullName}, Email : ${member.email}, ${member.status}`);

            // Attach the member to the request object
            req.member = member;

            next();
        } catch (error) {
            res.status(401);
            if (error instanceof TokenExpiredError) {
                logger.warn('Token has expired');
                throw new Error('Session expired, please login again');
            } else {
                logger.info(error);
                throw new Error(error);
            }
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No token provided');
    }
});

module.exports = { protect };