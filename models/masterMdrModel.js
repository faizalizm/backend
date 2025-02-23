const mongoose = require('mongoose');

const masterMdrSchema = new mongoose.Schema({
    mdrAmount: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify MDR amount'],
        default: 0, // Default is 0
        min: [0, 'MDR amount cannot be negative'] // Prevent negative value
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MasterMdr', masterMdrSchema);