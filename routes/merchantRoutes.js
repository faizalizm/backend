const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    searchMerchant,
    getMerchant,
    registerMerchant,
    updateMerchant
} = require('../controllers/merchantController');

const router = express.Router();

router.get('/', protect, getMerchant);
router.post('/', protect, registerMerchant);
router.patch('/', protect, updateMerchant);

router.get('/search', protect, searchMerchant);

module.exports = router;