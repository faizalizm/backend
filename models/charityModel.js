const mongoose = require('mongoose');
const moment = require('moment-timezone');

const charitySchema = new mongoose.Schema({
    picture: {
        type: String,
        default: null,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format (basic validation)
                return (
                    value === null ||
                    /^data:image\/(jpg|jpeg|png|webp);base64,/.test(value)
                );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    name: {
        type: String,
        required: [true, 'Please specify charity name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please specify charity description'],
        trim: true
    },
    category: {
        type: [String],
        required: [true, 'Please specify category']
    },
    donationAmount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify donation amount'],
        default: 0, // Default is 0
        min: [0, 'Donation amount cannot be negative'] // Prevent negative value
    },
    donationCount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify donation count'],
        default: 0, // Default is 0
        min: [0, 'Donation count cannot be negative'] // Prevent negative value
    },
    contributedAmount: {
        type: Number, // Using Number for calculations
        default: 0, // Default is 0
        min: [0, 'Donation amount cannot be negative'] // Prevent negative value
    },
    goalAmount: {
        type: Number, // Using Number for calculations
        required: [true, 'Goal amount is required'],
        default: 0, // Default balance is 0
        min: [0, 'Goal amount cannot be negative'] // Prevent negative value
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

charitySchema.set('toJSON', {
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

module.exports = mongoose.model('Charity', charitySchema);