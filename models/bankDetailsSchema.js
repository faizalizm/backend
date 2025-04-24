const mongoose = require('mongoose');
const moment = require('moment-timezone');

const bankDetailsSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    bankAccountName: {
        type: String,
        required: true,
        trim: true
    },
    bankAccountNumber: {
        type: String,
        required: true,
        trim: true
    }
}, {
    _id: false,
    timestamps: true
});

bankDetailsSchema.set('toJSON', {
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

module.exports = bankDetailsSchema;