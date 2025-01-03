const mongoose = require('mongoose');
const charitySchema = new mongoose.Schema({
    picture: {
        type: String,
        default: null,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format (basic validation)
                return (
                        value === null ||
                        /^data:image\/(jpg|jpeg|png);base64,/.test(value)
                        );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    name: {
        type: String,
        required: [true, 'Please specify charity name']
    },
    description: {
        type: String,
        required: [true, 'Please specify charity description']
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
    goal: {
        type: Number, // Using Number for calculations
        required: [true, 'Donation amount is required'],
        default: 0, // Default balance is 0
        min: [0, 'Balance Cannot Be Negative'] // Prevent negative value
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Charity', charitySchema);