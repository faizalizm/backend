const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    getPointsReward,
    getPoints,
    getPointHistory,
    redeemPoints,
    claimReward,
} = require('../controllers/pointsController');

const router = express.Router();

router.get('/resource', protect, getPointsReward);
router.get('/', protect, getPoints);
router.get('/history', protect, getPointHistory);
router.post('/redeem', protect, redeemPoints);
router.post('/claim', protect, claimReward);

module.exports = router;