const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    getBanner
} = require('../controllers/bannerController');

const router = express.Router();

router.get('/resource', protect, getBanner);

module.exports = router;