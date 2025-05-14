const mongoose = require('mongoose');
const moment = require('moment-timezone');

const referralSchema = require('./referralSchema');
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
        required: [true, 'Please specify name'],
        trim: true
    },
    userName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please specify email'],
        unique: true, // Prevent register email twice
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Please specify password']
    },
    phone: {
        type: String,
        required: [true, 'Please specify phone'],
        unique: true, // Prevent register phone twice
        trim: true
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
        mipayAccountNumber: {
            type: String
        },
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