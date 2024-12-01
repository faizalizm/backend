const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getWallet,
    topupWallet,
    withdrawWallet,
    transferWallet,
    qrPaymentWallet,
    genQRCode
} = require('../controllers/walletController');

const router = express.Router();

router.get('/', protect, getWallet);
router.post('/topup', protect, topupWallet);
router.post('/withdrawal', protect, withdrawWallet);
router.get('/transfer', protect, transferWallet);
router.post('/transfer', protect, transferWallet);
router.post('/qrPayment', protect, qrPaymentWallet);
router.get('/qrcode', protect, genQRCode);

module.exports = router;