const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true
    },
    type: {
        type: String,
        required: [true, 'Please add type'],
        enum: [
            'Transfer via Phone',
            'Transfer via Email',
            'Transfer via QR Payment',
            'Withdrawal',
            'Top Up',
            'VIP Payment'
        ],
    },
    status: {
        type: String,
        required: [true, 'Please add status'],
        enum: ['In Progress', 'Success', 'Failed', 'Expired'],
    },
    recipientMemberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the recipient member
        default: null // For transfer
    },
    paymentCode: {
        type: String,
        default: null // For QR Payment
    },
    packageCode: {
        type: String,
        default: null // For VIP Payment
    },
    amount: {
        type: Number,
        required: [true, 'Please specify the amount'],
        min: [0, 'Amount must be a positive number']
    },
    notes: {
        type: String,
        default: null, // Optional field for additional transaction info
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);