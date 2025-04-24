const mongoose = require('mongoose');
const moment = require('moment-timezone');

const otpSchema = new mongoose.Schema({
    // OTP tie to email/phone
    email: {
        type: String
    },
    phone: {
        type: String
    },
    otp: {
        type: Number
    },
    otpExpiry: {
        type: Date
    }
}, {
    timestamps: true
});

otpSchema.methods.canSendOtp = function () {
    const now = new Date();
    const lastSent = this.createdAt;
    const interval = 2 * 60 * 1000; // 2 minutes in milliseconds
    return now - lastSent >= interval;
};

otpSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.otpExpiry) {
            ret.otpExpiry = moment(ret.otpExpiry).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        if (ret.createdAt) {
            ret.createdAt = moment(ret.createdAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        if (ret.updatedAt) {
            ret.updatedAt = moment(ret.updatedAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        return ret;
    }
});

module.exports = mongoose.model('Otp', otpSchema);