const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    bankAccountName: {
        type: String,
        required: true,
        trim: true
    },
    bankAccountNumber: {
        type: String,
        required: true,
        trim: true
    }
}, {
    _id: false,
    timestamps: true
});

module.exports = bankDetailsSchema;