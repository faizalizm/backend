const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true
    },
    type: { // Transfer via Phone| Transfer via Email|Transfer via QR Payment|Withdrawal|Top Up
        type: String,
        required: [true, 'Please add type']
    },
    status: { // In Progress -> Success|Failed|Expired
        type: String,
        required: [true, 'Please add status']
    },
    recipientMemberId: { // 
        type: String,
        required: [true, 'Please add status']
    },
    paymentCode: {// For Transfer
        type: String,
        default: null
    },
    packageCode: {
        type: String,
        default: null
    },
    // 
    categoryCode: {
        type: String,
        required: true,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);