const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
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
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null, // Null if there's no referral
    },
    // 
    referralCode: {
        type: String,
        required: true,
        default: null
    },
    referrals: {
        type: [
            {
                level: {
                    type: String,
                    required: true
                },
                referrals: {
                    type: [
                        {
                            referrerId: {
                                type: mongoose.Schema.Types.ObjectId,
                                ref: 'Member', // Reference to the referrer
                            },
                            memberId: {
                                type: mongoose.Schema.Types.ObjectId,
                                ref: 'Member', // Reference to the referred member
                                required: true
                            },
                            referredAt: {
                                type: Date,
                                default: Date.now // Default to current date/time
                            }
                        }
                    ],
                    _id: false,
                    default: [] // Default to an empty array if no referrals are provided
                }
            }
        ],
        _id: false,
        default: [] // Default to an empty array
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Member', memberSchema);