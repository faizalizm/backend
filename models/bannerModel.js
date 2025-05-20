const mongoose = require('mongoose');
const moment = require('moment-timezone');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please specify title'],
        unique: true,
        trim: true
    },
    link: {
        type: String,
        trim: true,
        validate: {
            validator: function (value) {
                // Allow null or empty string; validate URL only if a non-empty string is provided
                return value === '' || value === null || /^https?:\/\/.+/.test(value);
            },
            message: 'Invalid URL'
        }
    },
    picture: {
        type: String,
        default: null,
        required: function () {
            // Only require picture on creation
            return this.isNew;
        },
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format (basic validation)
                return (
                    value === null ||
                    /^data:image\/(jpg|jpeg|png|webp);base64,/.test(value)
                );
            },
            message: 'Invalid Image Format.'
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

bannerSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.startDate) {
            ret.startDate = moment(ret.startDate).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
        }
        if (ret.endDate) {
            ret.endDate = moment(ret.endDate).tz(process.env.TIMEZONE).format(process.env.TIMESTAMP_FORMAT_DISPLAY);
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

module.exports = mongoose.model('Banner', bannerSchema);