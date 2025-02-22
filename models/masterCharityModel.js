const mongoose = require('mongoose');

const masterCharitySchema = new mongoose.Schema({
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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MasterCharity', masterCharitySchema);