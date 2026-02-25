const express = require('express');
const router = express.Router();
const { getMarks, submitBulkMarks } = require('../controllers/markController');
const { protect } = require('../middleware/authMiddleware');

// Base Route: /api/marks

// Fetch existing marks via query params
router.get('/', protect, getMarks);

// Submit or update marks in bulk
router.post('/submit', protect, submitBulkMarks);

module.exports = router;
