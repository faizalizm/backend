const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getCharity
} = require('../controllers/charityController');

const router = express.Router();

router.get('/', protect, getCharity);

module.exports = router;