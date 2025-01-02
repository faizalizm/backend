const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    searchMerchant,
    getMerchant,
    registerMerchant,
    updateMerchant,
    qrSpending,
    genQRCode
} = require('../controllers/merchantController');

const router = express.Router();

router.get('/', protect, getMerchant);
router.post('/', protect, registerMerchant);
router.patch('/', protect, updateMerchant);
router.post('/qrSpending', protect, qrSpending);
router.get('/qrcode', protect, genQRCode);

router.get('/search', protect, searchMerchant);

module.exports = router;