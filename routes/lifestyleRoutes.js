const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    getLifestyle
} = require('../controllers/lifestyleController');

const router = express.Router();

router.get('/resource', protect, getLifestyle);

module.exports = router;