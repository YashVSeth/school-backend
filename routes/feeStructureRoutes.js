const express = require('express');
const router = express.Router();
const { getFeeStructureByClass, saveFeeStructure } = require('../controllers/feeStructureController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Get fee structure by class ID
router.get('/:classId', protect, adminOnly, getFeeStructureByClass);

// Save/Update fee structure
router.post('/:classId', protect, adminOnly, saveFeeStructure);

module.exports = router;