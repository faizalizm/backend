const mongoose = require('mongoose');
const moment = require('moment-timezone');

const bankDetailsSchema = require('./bankDetailsSchema');
const shippingDetailsSchema = require('./shippingDetailsSchema');

const transactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet', // Reference to the referred wallet
        required: true,
        unique: true
    },
    systemType: {
        type: String,
        required: true,
        enum: ['FPX', 'HubWallet', 'HubPoints'] // Differentiate between the systems
    },
    type: {
        type: String,
        required: [true, 'Please specify type'],
        enum: [
            'Credit', // Added
            'Debit', // Deducted
            'N/A' // For FPX
        ]
    },
    description: {
        type: String,
        required: [true, 'Please specify description'],
        enum: [
            'Top Up',
            'Withdrawal',
            'Transfer via Phone',
            'Transfer via Email',
            'Transfer via Username',
            'QR Payment',
            'Merchant QR Payment',
            'VIP Payment',
            'VIP Registration Commission',
            'Spending Rewards',
            'Spending Rewards Commision',
            'Points Redemption',
            'Cashback'
        ]
    },
    status: {
        type: String,
        required: [true, 'Please specify status'],
        enum: ['In Progress', 'Success', 'Failed', 'Expired']
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        default: null // For VIP Registration Commision/Spending Rewards (Who is the initiator)
    },
    counterpartyWalletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet', // Reference to the recipient member
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
        required: [true, 'Please specify amount'],
        min: [0, 'Amount must be a positive number']
    },
    charitableContribution: {
        type: Number,
        min: [0, 'Charitable contribution must be a positive number']
    },
    merchantDiscountRate: {
        type: Number,
        min: [0, 'Merchant discount rate must be a positive number']
    },
    withdrawalDetails: {
        type: {
            type: String,
            enum: ['MiPay', 'Bank']
        },
        mipayAccountNumber: {
            type: String
        },
        bankDetails: {
            type: bankDetailsSchema
        }
    },
    shippingStatus: {// Shipping Status - For txn involve Shipping
        type: String,
        enum: ['Preparing', 'Shipped', 'Delivered']
    },
    shippingDetails: {// Shipping Details - For txn involve Shipping
        type: shippingDetailsSchema
    }
}, {
    timestamps: true
});

transactionSchema.set('toJSON', {
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

module.exports = mongoose.model('Transaction', transactionSchema);