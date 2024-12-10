const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    registerMember,
    loginMember,
    getMember,
    updateMember,
    inviteMember,
    getReferral,
    getReferralV2,
    getVIPStatistic
} = require('../controllers/memberController');

const router = express.Router();

router.post('/register', registerMember);
router.post('/login', loginMember);

router.get('/', protect, getMember);
router.patch('/', protect, updateMember); // MBR-4, MBR-6, 
router.post('/invite', protect, inviteMember);
router.get('/referral', protect, getReferral);
router.get('/referralV2', protect, getReferralV2);
router.get('/vip/statistic', protect, getVIPStatistic);

module.exports = router;
