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
            ret.referredAt = moment(ret.referredAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
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

// STATISTICS 
const referralStatsSchema = new mongoose.Schema({
    level: { // 1 to 20
      type: Number,
      required: true
    },
    vip: {
      type: Number,
      default: 0
    },
    user: {
      type: Number,
      default: 0
    }
  }, { _id: false });

module.exports = {referralSchema, referralStatsSchema};
