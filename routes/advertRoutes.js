const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getAdvert
} = require('../controllers/advertController');

const router = express.Router();

router.get('/', protect, getAdvert);

module.exports = router;