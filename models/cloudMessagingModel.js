const mongoose = require('mongoose');

const cloudMessagingModel = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true,
        unique: true
    },
    token: {
        type: String,
        required: [true, 'Please specify token'],
        unique: true
    },
    lastSent: {
        type: Date
    }
}, {
    timestamps: true
});
module.exports = mongoose.model('CloudMessaging', cloudMessagingModel);