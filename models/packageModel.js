const mongoose = require('mongoose');
const moment = require('moment-timezone');

const packageSchema = new mongoose.Schema({
    picture: {
        type: String,
        default: null,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format (basic validation)
                return (
                        value === null ||
                        /^data:image\/(jpg|jpeg|png);base64,/.test(value)
                        );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    type: {
        type: String,
        required: [true, 'Please specify type'],
        enum: ['VIP', 'Topup'],
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Please specify name'],
        trim: true
    },
    description: {
        type: [String], // Array for multiline desc,
        required: [true, 'Please specify description']
    },
    price: {
        type: String,
        default: null, // User set if topup
        trim: true
    },
    code: {
        type: String,
        unique: true, // code for frontend selection
        trim: true
    },
    categoryCode: {
        type: String,
        required: [true, 'Please specify categoryCode'],
        unique: true, // ToyyibPay categoryCode, only backend internal
        trim: true
    },
    packageCharge: {
        type: Number,
        required: [true, 'Please specify packageCharge'],
        enum: ['0', '1', '2'] // 0 = Charge owner || 1 = Charge bill owner
    },
    emailContent: {
        type: String,
        required: [true, 'Please specify emailContent'],
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive']
    }
}, {
    timestamps: true
});

packageSchema.set('toJSON', {
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

module.exports = mongoose.model('Package', packageSchema);