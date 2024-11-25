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
            message: 'Invalid Base64 image format.'
        }
    },
    name: {
        type: String,
        required: [true, 'Please add your name']
    },
    description: {
        type: String,
        required: [true, 'Please add your description'],
        unique: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);