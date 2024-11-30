const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getWallet,
    topupWallet,
    withdrawWallet,
    transferWallet,
    spendWallet
} = require('../controllers/walletController');

const router = express.Router();

router.get('/', protect, getWallet);
router.post('/topup', protect, topupWallet);
router.post('/withdraw', protect, withdrawWallet);
router.post('/transfer', protect, transferWallet);
router.post('/spend', protect, spendWallet);

module.exports = router;
