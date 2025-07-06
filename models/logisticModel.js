const mongoose = require('mongoose');
const moment = require('moment-timezone');

const shippingDetailsSchema = require('./shippingDetailsSchema');

const logisticSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction', // Reference to the referred transaction
        required: function () {
            return this.systemType === 'Points Reward';
        },
    },
    referenceNumber: {
        type: String,
        required: true,
        unique: true
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
    statusHistory: [
        {
            _id: false,
            status: {
                type: String,
                enum: ['Preparing', 'In Transit', 'Delivered', 'Cancelled', 'Returned'],
                required: true
            },
            updatedAt: {
                type: Date,
                default: Date.now
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Member', // Admin-initiated status changes
                default: null
            },
            note: {
                type: String,
                default: null
            }
        }
    ]
}, {
    timestamps: true
});

logisticSchema.set('toJSON', {
    transform: function (doc, ret) {

        if (Array.isArray(ret.statusHistory)) {
            ret.statusHistory = ret.statusHistory.map(entry => {
                if (entry.updatedAt) {
                    return {
                        ...entry,
                        updatedAt: moment(entry.updatedAt).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY)
                    };
                }
                return entry;
            });
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