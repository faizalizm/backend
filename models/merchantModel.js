const mongoose = require('mongoose');

const merchantModel = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the referred member
        required: true,
        unique: true
    },
    spendingCode: {
        type: String,
        required: [true, 'Please specify spending code'],
        unique: true
    },
    logo: {
        type: String,
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
    name: {
        type: String,
        required: [true, 'Please specify name'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Please specify phone'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please specify description'],
        trim: true
    },
    bizType: {
        type: String,
        required: [true, 'Please specify business type'],
        enum: ['Individual', 'Corporate']
    },
    operatingDays: {
        type: [String], // Array of strings
        required: [true, 'Please specify operating days'],
        validate: {
            validator: function (value) {
                const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                // Ensure every day in the array is valid
                return Array.isArray(value) && value.every(day => validDays.includes(day));
            },
            message: 'Operating days must be valid day names (e.g., Monday, Tuesday, etc.).'
        }
    },
    openingTime: {
        type: String,
        required: [true, 'Please specify your opening time'],
        validate: {
            validator: function (value) {
                // Ensure the time is in 24-hour format (HH:MM)
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
            },
            message: 'Opening time must be in 24-hour format (e.g., 08:00).'
        }
    },
    closingTime: {
        type: String,
        required: [true, 'Please specify your closing time'],
        validate: {
            validator: function (value) {
                // Ensure the time is in 24-hour format (HH:MM)
                const isValidFormat = /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
                if (!isValidFormat)
                    return false;

                // For update scenarios, use this.openingTime if available
                const openingTime = this.openingTime || this.getUpdate().$set.openingTime;

                if (!openingTime)
                    return true; // Skip validation if openingTime is not provided

                const opening = openingTime.split(':').map(Number);
                const closing = value.split(':').map(Number);
                return (closing[0] > opening[0] || (closing[0] === opening[0] && closing[1] > opening[1]));
            },
            message:
                    'Closing time must be in 24-hour format (e.g., 17:00) and later than opening time.'
        }
    },
    cashbackRate: {
        type: Number, // Using Number for calculations
        required: [true, 'Please specify cashback rate'],
        min: [1, 'Cashback rate must be at least 1%'],
        max: [100, 'Cashback rate cannot exceed 100%'],
        validate: {
            validator: function (value) {
                // Ensure the number has at most two decimal places
                return /^(\d+)(\.\d{1,2})?$/.test(value.toString());
            },
            message: 'Cashback rate must be a number with up to two decimal places.'
        },
        set: function (value) {
            // Ensure the number always has two decimal places
            return Number(value).toFixed(2);
        }
    },
    // Same with shipping details
    addressLine1: {
        type: String,
        required: [true, 'Please specify address line 1'],
        trim: true
    },
    addressLine2: {
        type: String,
        trim: true
    },
    addressLine3: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        required: [true, 'Please specify city'],
        trim: true
    },
    state: {
        type: String,
        required: [true, 'Please specify state'],
        trim: true
    },
    postCode: {
        type: String,
        required: [true, 'Please specify post code'],
        validate: {
            validator: function (value) {
                return /^\d{5}$/.test(value); // Adjust for country-specific formats
            },
            message: 'Invalid post code format.'
        },
        trim: true
    },
    country: {
        type: String,
        required: [true, 'Please specify country'],
        trim: true
    }
}, {
    timestamps: true
});
module.exports = mongoose.model('Merchant', merchantModel);