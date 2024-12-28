const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getPackage,
    purchasePackage,
    purchaseCallbackPackage
} = require('../controllers/packageController');

const router = express.Router();

router.get('/', protect, getPackage);
router.post('/purchase', protect, purchasePackage);
router.post('/callback', purchaseCallbackPackage);

module.exports = router;