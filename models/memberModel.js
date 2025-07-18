const mongoose = require('mongoose');
const moment = require('moment-timezone');

const { referralSchema, referralStatsSchema } = require('./referralSchema');
const bankDetailsSchema = require('./bankDetailsSchema');
const shippingDetailsSchema = require('./shippingDetailsSchema');

const memberSchema = new mongoose.Schema({
    profilePicture: {
        type: String,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format
                return (
                    value === null ||
                    /^data:image\/(jpg|jpeg|png);base64,/.test(value)
                );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    fullName: {
        type: String,
        // required: [true, 'Please specify name'],
        trim: true
    },
    userName: {
        type: String,
        unique: true,
        sparse: true, // ignore null duplicates
        trim: true,
        lowercase: true, // ensures value is saved in lowercase
        match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes']
    },
    email: {
        type: String,
        required: [true, 'Please specify email'],
        unique: true, // Prevent register email twice
        lowercase: true,
        trim: true,
        validate: {
            validator: function (value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Invalid email format.'
        }
    },
    password: {
        type: String,
        required: [true, 'Please specify password']
    },
    phone: {
        type: String,
        // required: [true, 'Please specify phone'],
        unique: true, // Prevent register phone twice
        trim: true,
        sparse: true
    },
    refreshToken: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null // Null if there's no referral
    },
    referralCode: {
        type: String,
        required: true
    },
    referrals: {
        type: [referralSchema],
        default: [] // Default to an empty array
    },
    referralStats: {
        type: [referralStatsSchema],
        default: [] // Default to an empty array
    },
    type: {
        type: String,
        default: 'User', // User|VIP
        enum: ['User', 'VIP'] // Restrict to allowed values
    },
    vipAt: {
        type: Date
    },
    // Bank Details
    withdrawalDetails: {
        bankDetails: {
            type: bankDetailsSchema
        }
    },
    // Shipping Details
    shippingDetails: {
        type: shippingDetailsSchema
    },
    status: {
        type: String,
        enum: ['Deleted', 'Deactivated', 'Active'],
        default: 'Active'
    },
    isDeleted: {
        type: Boolean
    }
}, {
    timestamps: true
});

memberSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.vipAt) {
            ret.vipAt = moment(ret.vipAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        if (ret.createdAt) {
            ret.createdAt = moment(ret.createdAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        if (ret.updatedAt) {
            ret.updatedAt = moment(ret.updatedAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        return ret;
    }
});

module.exports = mongoose.model('Member', memberSchema);