const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getPackage,
    purchasePackage
} = require('../controllers/packageController');

const router = express.Router();

router.get('/', protect, getPackage);
router.post('/purchase', protect, purchasePackage);

module.exports = router;
