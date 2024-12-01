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
        required: [true, 'Please add type'],
        enum: ['VIP', 'Topup']
    },
    name: {
        type: String,
        required: [true, 'Please add name']
    },
    description: {
        type: String,
        required: [true, 'Please add description'],
    },
    price: {
        type: String,
        default: null // User set if topup
    },
    code: {
        type: String,
        required: [true, 'Please add code'],
        unique: true // ToyyibPay categoryCode
    },
    paymentChannel: {
        type: String,
        required: [true, 'Please add paymentChannel'],
        enum: ['0', '1', '2'] // 0 = FPX || 1 = CC || 2 = BOTH
    },
    packageCharge: {
        type: String,
        required: [true, 'Please add packageCharge'],
        enum: ['0', '1', '2'] // 0 = Charge owner || 1 = Charge bill owner
    },
    emailContent: {
        type: String,
        required: [true, 'Please add emailContent']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);