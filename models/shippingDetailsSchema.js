const mongoose = require('mongoose');
const moment = require('moment-timezone');

const shippingDetailsSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        trim: true
    },
    addressLine1: {
        type: String,
        required: true,
        trim: true
    },
    addressLine2: {
        type: String,
        trim: true
    },
    addressLine3: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    postCode: {
        type: String,
        required: true,
        validate: {
            validator: function (value) {
                return /^\d{5}$/.test(value); // Adjust for country-specific formats
            },
            message: 'Invalid post code format.'
        },
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    }
}, {
    _id: false,
    timestamps: true
});

shippingDetailsSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.createdAt) {
            ret.createdAt = moment(ret.createdAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        if (ret.updatedAt) {
            ret.updatedAt = moment(ret.updatedAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        return ret;
    }
});

module.exports = shippingDetailsSchema;