const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const protect = authMiddleware.protect || authMiddleware;

const dashboardController = require('../controllers/dashboardController');

// All aggregated UI widgets
router.get('/widgets', protect, dashboardController.getDashboardWidgets);

module.exports = router;
