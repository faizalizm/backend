const mongoose = require('mongoose');

const shippingDetailsSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String
    },
    addressLine3: {
        type: String
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String
    },
    postCode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    }
}, {
    _id: false,
    timestamps: true
});

module.exports = shippingDetailsSchema;