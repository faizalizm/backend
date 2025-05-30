const mongoose = require('mongoose');
const moment = require('moment-timezone');

const masterCharitySchema = new mongoose.Schema({
    donationAmount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify donation amount'],
        default: 0, // Default is 0
        min: [0, 'Donation amount cannot be negative'] // Prevent negative value
    },
    donationCount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify donation count'],
        default: 0, // Default is 0
        min: [0, 'Donation count cannot be negative'] // Prevent negative value
    }
}, {
    timestamps: true
});

masterCharitySchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.createdAt) {
            ret.createdAt = moment(ret.createdAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        if (ret.updatedAt) {
            ret.updatedAt = moment(ret.updatedAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        return ret;
    }
});

module.exports = mongoose.model('MasterCharity', masterCharitySchema);