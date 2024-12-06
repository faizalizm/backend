const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    profilePicture: {
        type: String,
        default: null,
        validate: {
            validator: function (value) {
                // Ensure the string is a valid Base64 image format
                return (
                        value === null ||
                        /^data:image\/(jpg|jpeg|png);base64,/.test(value)
                        );
            },
            message: 'Invalid Base64 Image Format.'
        }
    },
    fullName: {
        type: String,
        required: [true, 'Please add your name']
    },
    email: {
        type: String,
        required: [true, 'Please add your email'],
        unique: true // Prevent register email twice
    },
    password: {
        type: String,
        required: [true, 'Please add your password']
    },
    phone: {
        type: String,
        required: [true, 'Please add your phone'],
        unique: true // Prevent register phone twice
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null // Null if there's no referral
    },
    referralCode: {
        type: String,
        required: true
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
                                ref: 'Member' // Reference to the referrer
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
    },
    type: {
        type: String,
        default: 'User', // User|VIP
        enum: ['User', 'VIP'] // Restrict to allowed values
    },
    vipAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Member', memberSchema);