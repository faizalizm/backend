const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { logger } = require('../services/logger');

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
        pinTries: { // Tries untuk lockout
            type: Number,
            default: 5
        },
        minPinPrompt: {
            type: Number,
            default: 0
        },
        maxPinPrompt: {
            type: Number,
            default: 100000
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
        dailyTransferLimit: {
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
    bankTransfer: {
        recipientBank: {
            type: String,
        },
        recipientName: {
            default: String
        },
        recipientAccountNumber: {
            type: String,
        },
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
        ebook: {
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

// Caching
let configCache = null;
let lastFetched = 0;
const TTL = 60_000; // 1 minute

// ✅ Static method: get full config with caching
configurationSchema.statics.getSingleton = async function () {
    const now = Date.now();
    if (configCache && now - lastFetched < TTL) {
        logger.info('Returning cached configuration');
        return configCache;
    }
    logger.info('Fetching configuration from database');
    configCache = await this.findOne({}).lean();
    lastFetched = now;
    return configCache;
};

module.exports = mongoose.model('Configuration', configurationSchema);