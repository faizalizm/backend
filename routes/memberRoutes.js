const express = require('express');
const {validate} = require('../middleware/validatorMiddleware');
const {protect} = require('../middleware/authMiddleware');

const {
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
} = require('../schemas/memberSchema');

const {
    registerMember,
    loginMember,
    getOtp,
    deleteMember,
    resetPassword,
    getMember,
    updateMember,
    inviteMember,
    getReferral,
    getVIPStatistic
} = require('../controllers/memberController');

const router = express.Router();

router.post('/register', validate(registerMemberSchema), registerMember);
router.post('/login', validate(loginMemberSchema), loginMember);

router.get('/otp', getOtp);
router.delete('/', deleteMember);
router.post('/resetPassword', resetPassword);

router.get('/', protect, getMember);
router.patch('/', protect, updateMember); // MBR-4, MBR-6, 
router.post('/invite', protect, inviteMember);
router.get('/referral', protect, getReferral);
router.get('/vip/statistic', protect, getVIPStatistic);

module.exports = router;
