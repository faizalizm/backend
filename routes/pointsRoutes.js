const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getPoints,
    redeemPoints
} = require('../controllers/pointsController');

const router = express.Router();

router.get('/', protect, getPoints);
router.post('/redeem', protect, redeemPoints);

module.exports = router;