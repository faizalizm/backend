const mongoose = require('mongoose');
const moment = require('moment-timezone');

const shippingDetailsSchema = require('./shippingDetailsSchema');

const logisticSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction', // Reference to the referred transaction
        required: function () {
            return this.systemType === 'Points Reward';
        },
    },
    systemType: {
        type: String,
        required: [true, 'Please specify type'],
        enum: [
            'Lifestyle Reward',
            'Points Reward',
        ]
    },
    description: {
        type: String,
        required: [true, 'Please specify description'],
    },
    pointsRewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PointsReward',
    },
    lifestyleRewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lifestyle',
    },
    status: {
        type: String,
        required: [true, 'Please specify status'],
        enum: ['Preparing', 'In Transit', 'Delivered']
    },
    shippingDetails: {// Shipping Details - For txn involve Shipping
        type: shippingDetailsSchema,
        required: [true, 'Please specify shipping details'],
    },
    trackingNumber: {
        type: String,
        trim: true
    },
    courier: {
        type: String,
        trim: true
    },
    inTransitAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

logisticSchema.set('toJSON', {
    transform: function (doc, ret) {

        if (ret.inTransitAt) {
            ret.inTransitAt = moment(ret.inTransitAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        if (ret.deliveredAt) {
            ret.deliveredAt = moment(ret.deliveredAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
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

module.exports = mongoose.model('Logistic', logisticSchema);