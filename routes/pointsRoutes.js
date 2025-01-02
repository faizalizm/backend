const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getPoints
} = require('../controllers/pointsController');

const router = express.Router();

router.get('/', protect, getPoints);

module.exports = router;