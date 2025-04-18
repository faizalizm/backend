const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    picture: {
        type: String,
        default: null,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format (basic validation)
                return (
                        value === null ||
                        /^data:image\/(jpg|jpeg|png);base64,/.test(value)
                        );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    type: {
        type: String,
        required: [true, 'Please specify type'],
        enum: ['VIP', 'Topup'],
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Please specify name'],
        trim: true
    },
    description: {
        type: [String], // Array for multiline desc,
        required: [true, 'Please specify description']
    },
    price: {
        type: String,
        default: null, // User set if topup
        trim: true
    },
    code: {
        type: String,
        unique: true, // code for frontend selection
        trim: true
    },
    categoryCode: {
        type: String,
        required: [true, 'Please specify categoryCode'],
        unique: true, // ToyyibPay categoryCode, only backend internal
        trim: true
    },
    packageCharge: {
        type: Number,
        required: [true, 'Please specify packageCharge'],
        enum: ['0', '1', '2'] // 0 = Charge owner || 1 = Charge bill owner
    },
    emailContent: {
        type: String,
        required: [true, 'Please specify emailContent'],
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);