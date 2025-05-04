const mongoose = require('mongoose');
const moment = require('moment-timezone');

const masterMdrSchema = new mongoose.Schema({
    mdrAmount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify MDR amount'],
        default: 0, // Default is 0
        min: [0, 'MDR amount cannot be negative'] // Prevent negative value
    }
}, {
    timestamps: true
});

masterMdrSchema.set('toJSON', {
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

module.exports = mongoose.model('MasterMdr', masterMdrSchema);