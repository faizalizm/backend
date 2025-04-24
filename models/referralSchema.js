const mongoose = require('mongoose');
const moment = require('moment-timezone');

const referralItemSchema = new mongoose.Schema({

    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member' // Reference to the referrer
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true
    },
    referredAt: {
        type: Date,
        default: Date.now // Default to current date/time
    }
}, {
    _id: false
});

referralItemSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.referredAt) {
            ret.referredAt = moment(ret.referredAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT);
        }
        return ret;
    }
});

const referralSchema = new mongoose.Schema({
    level: {
        type: String,
        required: true
    },
    referrals: {
        type: [referralItemSchema],
        default: []
    }
}, {
    _id: false
});

module.exports = referralSchema;
