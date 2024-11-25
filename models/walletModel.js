const mongooseMember = require('mongoose');

const memberSchema = new mongooseMember.Schema({
    profilePicture: {
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
            message: 'Invalid Base64 image format.'
        }
    },
    fullName: {
        type: String,
        required: [true, 'Please add your name']
    },
    email: {
        type: String,
        required: [true, 'Please add your email'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add your password'],
        unique: true
    },
    phone: {
        type: String,
        required: [true, 'Please add your phone']
    },
    paymentCode: {
        type: String,
        default: null
    },
    referralCode: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongooseMember.model('Member', memberSchema);