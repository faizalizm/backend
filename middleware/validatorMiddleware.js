const {ValidationError} = require('joi');

const {logger} = require('../services/logger');

const validate = (schema) => {
    return (req, res, next) => {
        const {error} = schema.validate(req.body, {abortEarly: false, allowUnknown: true});

        if (error) {
            logger.error(error.details.map(err => err.message).join(', '));
            throw new Error(error.details.map(err => err.message).join(', '));
        }

        next();
    };
};

module.exports = {validate};