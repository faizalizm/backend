const mongoose = require('mongoose');

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

module.exports = mongoose.model('Otp', otpSchema);