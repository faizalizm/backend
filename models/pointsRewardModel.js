const mongoose = require('mongoose');
const moment = require('moment-timezone');

const pointsRewardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please specify title'],
        unique: true,
        trim: true
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
    description: {
        type: [String], // Array for multiline desc,
        required: [true, 'Please specify description'],
        validate: {
            validator: function (arr) {
                return arr.every(line => typeof line === 'string');
            },
            message: 'All description items must be strings',
        }
    },
    pointsRequirement: {
        type: Number,
        required: [true, 'Please specify points requirement'],
        min: [0, 'Points requirement must be a positive number']
    },
    priority: {
        type: Number,
        required: [true, 'Please specify priority']
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

pointsRewardSchema.set('toJSON', {
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

module.exports = mongoose.model('PointsReward', pointsRewardSchema);