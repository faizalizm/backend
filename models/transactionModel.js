const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet', // Reference to the referred wallet
        required: true
    },
    systemType: {
        type: String,
        required: true,
        enum: ['HubWallet', 'HubPoints'] // Differentiate between the systems
    },
    type: {
        type: String,
        required: [true, 'Please add type'],
        enum: [
            'Credit', // Added
            'Debit' // Deducted
        ]
    },
    description: {
        type: String,
        required: [true, 'Please add description'],
        enum: [
            'Top Up',
            'Withdrawal',
            'Transfer via Phone',
            'Transfer via Email',
            'QR Payment',
            'VIP Payment',
            'Redeem',
            'Cashback'
        ]
    },
    status: {
        type: String,
        required: [true, 'Please add status'],
        enum: ['In Progress', 'Success', 'Failed', 'Expired']
    },
    recipientMemberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the recipient member
        default: null // For transfer
    },
    billCode: {
        type: String,
        default: null // For Topup
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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);