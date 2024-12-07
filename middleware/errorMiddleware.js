const {logger} = require('../services/logger');

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode || 500;

    logger.error(err.stack);

    const errorResponse = {
        message: `[ID: ${req.requestId}] ${err.message}`,
    };

    // Include stack only in development
    if (process.env.NODE_ENV === 'DEV') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;