const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getPackage,
    purchasePackage,
    handlePaymentCallback
} = require('../controllers/packageController');

const router = express.Router();

router.get('/', protect, getPackage);
router.post('/purchase', protect, purchasePackage);
router.get('/purchase/callback', handlePaymentCallback); // No Protection Needed - For Payment Gateway

module.exports = router;
