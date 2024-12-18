const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true
    },
    bankAccountName: {
        type: String,
        required: true
    },
    bankAccountNumber: {
        type: String,
        required: true
    }
}, {
    _id: false,
    timestamps: true
});

module.exports = bankDetailsSchema;