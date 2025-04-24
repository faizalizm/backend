const mongoose = require('mongoose');
const moment = require('moment-timezone');

const cloudMessagingModel = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true,
        unique: true
    },
    token: {
        type: String,
        required: [true, 'Please specify token'],
        unique: true
    },
    lastSent: {
        type: Date
    }
}, {
    timestamps: true
});

cloudMessagingModel.set('toJSON', {
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

module.exports = mongoose.model('CloudMessaging', cloudMessagingModel);