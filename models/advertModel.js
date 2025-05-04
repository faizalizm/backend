const mongoose = require('mongoose');
const moment = require('moment-timezone');

const advertSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please specify title'],
        trim: true
    },
    link: {
        type: String,
        trim: true,
        validate: {
            validator: function (value) {
                return value === '' || /^https?:\/\/.+/.test(value);
            },
            message: 'Invalid URL'
        }
    },
    priority: {
        type: String,
        required: [true, 'Please specify priority'],
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    startDate: {
        type: Date,
        default: null
    },
    endDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

advertSchema.set('toJSON', {
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

module.exports = mongoose.model('Advert', advertSchema);