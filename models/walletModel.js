const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true
    },
    balance: {
        type: Number, // Using Number for calculations
        required: [true, 'Balance is required'],
        default: 0, // Default balance is 0
        min: [0, 'Balance Cannot Be Negative'] // Prevent negative balances
    },
    currency: {
        type: String,
        default: 'MYR', // Default currency
        enum: ['MYR'] // Restrict to supported currencies
    },
    paymentCode: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Wallet', walletSchema);