const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    getLifestyle,
    claimReward
} = require('../controllers/lifestyleController');

const router = express.Router();

router.get('/resource', protect, getLifestyle);
router.post('/claim', protect, claimReward);

module.exports = router;