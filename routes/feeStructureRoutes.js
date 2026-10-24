const express = require('express');
const router = express.Router();
const {
    getAllFeeStructures,
    getFeeStructureByClass,
    saveFeeStructure,
    copyFeeStructure,
    applyFeeStructureToClass
} = require('../controllers/feeStructureController');
const authMiddleware = require('../middleware/authMiddleware');
const protect = authMiddleware.protect || authMiddleware;
const adminOnly = authMiddleware.adminOnly || ((req, res, next) => next());

// Get all fee structures for an academic year (batch)
router.get('/all', protect, getAllFeeStructures);

// Copy fee structure from one class to others
router.post('/copy', protect, adminOnly, copyFeeStructure);

// Apply fee structure to students of a class
router.post('/apply/:classId', protect, adminOnly, applyFeeStructureToClass);

// Get fee structure by class ID
router.get('/:classId', protect, getFeeStructureByClass);

// Save/Update fee structure
router.post('/:classId', protect, adminOnly, saveFeeStructure);

module.exports = router;