const express = require('express');
const {protect} = require('../middleware/authMiddleware');

const {
    getCharity,
    getCharityGallery
} = require('../controllers/charityController');

const router = express.Router();

router.get('/', protect, getCharity);
router.get('/gallery', protect, getCharityGallery);

module.exports = router;