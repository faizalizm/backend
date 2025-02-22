const Joi = require('joi');

const registerMemberSchema = Joi.object({
    fullName: Joi.string()
            .min(3).max(50)
            .pattern(/^(?!.*\d).*$/)
            .message('Full name cannot contain numbers.')
            .required(),
    email: Joi.string().email().required(),
    password: Joi.string()
            .min(8).max(20)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$.!%*?&]{8,}$/)
            .message('Password must contain at least one uppercase letter, one lowercase letter, and one number.')
            .required(),
    phone: Joi.string()
            .pattern(/^(\+?\d{1,3})?\d{9,15}$/)
            .message('Phone number format is invalid')
            .required(),
    referredBy: Joi.string()
            .pattern(/^\d{6}$/)
            .message("ReferredBy must be exactly 6 digits")
            .required()
});

const loginMemberSchema = Joi.object({
    type: Joi.string().min(1).max(32),
    email: Joi.string().email(),
    password: Joi.string()
            .min(8).max(20)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$.!%*?&]{8,}$/)
            .message('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),
    phone: Joi.string()
            .pattern(/^(\+?\d{1,3})?\d{9,15}$/)
            .message('Phone number format is invalid'),
    refreshToken: Joi.string().min(1).max(256)
        .when('type', { is: 'biometric', then: Joi.required() }),
    fcmToken: Joi.string().min(1).max(256)
}).xor('email', 'phone');

module.exports = {
    registerMemberSchema,
    loginMemberSchema,
//    getOtpSchema,
//    deleteMemberSchema,
//    resetPasswordSchema,
//    getMemberSchema,
//    updateMemberSchema,
//    inviteMemberSchema,
//    getReferralSchema,
//    getVIPStatisticSchema
};