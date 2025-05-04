const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getHealth
} = require('../controllers/healthController');

const {
    getConfiguration
} = require('../controllers/configurationController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/configuration', protect, getConfiguration);

module.exports = router;