const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    registerMember,
    loginMember,
    getMember,
    updateMember,
    inviteMember,
    genQRCode,
    getReferral
} = require('../controllers/memberController');

const router = express.Router();

router.post('/register', registerMember);
router.post('/login', loginMember);

router.get('/', protect, getMember);
router.patch('/', protect, updateMember); // MBR-4, MBR-6, 
//router.post('/invite', protect, inviteMember);
router.get('/qrcode', protect, genQRCode);
router.get('/referral', protect, getReferral);

module.exports = router;
