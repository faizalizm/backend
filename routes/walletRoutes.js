const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    getWallet,
    topupWallet,
    withdrawWallet,
    transferVerification,
    transferWallet,
    qrPayment,
    genQRCode,
    updatePin
} = require('../controllers/walletController');

const router = express.Router();

router.get('/', protect, getWallet);
router.post('/topup', protect, topupWallet);
router.post('/withdrawal', protect, withdrawWallet);
router.post('/transfer', protect, transferWallet);
router.post('/transfer/verification', protect, transferVerification);
router.post('/qrPayment', protect, qrPayment);
router.get('/qrcode', protect, genQRCode);
router.post('/pin', protect, updatePin);

module.exports = router;