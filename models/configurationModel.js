const mongoose = require('mongoose');
const moment = require('moment-timezone');

const configurationSchema = new mongoose.Schema({
    appVersion: {
        latest: {
            type: String
        },
        minimum: {
            type: String
        }
    },
    resources: {
        banner: {
            type: Date
        },
        advert: {
            type: Date
        },
        package: {
            type: Date
        },
        lifestyle: {
            type: Date
        },
        charity: {
            type: Date
        },
        pointsReward: {
            type: Date
        }
    },
    payments: {
        minForPin: {
            type: Number,
            default: 250
        },
    },
    transaction: {
        dailyTopupLimit: {
            type: Number,
            default: 3000
        },
        dailyWithdrawLimit: {
            type: Number,
            default: 3000
        },
        maxBalance: {
            type: Number,
            default: 3000
        },
    },
    customerServiceNo: {
        type: String
    },
    links: {
        terms: {
            type: String
        },
        policy: {
            type: String
        },
        faq: {
            type: String
        },
        deletion: {
            type: String
        },
    }
}, {
    timestamps: true
});

configurationSchema.set('toJSON', {
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

module.exports = mongoose.model('Configuration', configurationSchema);