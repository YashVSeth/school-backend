const express = require('express');
const router = express.Router();

// 1. Import Controller
const feeStructureController = require('../controllers/feeStructureController');

// 2. Import Middleware (MUST use curly braces)
const { protect, adminOnly } = require('../middleware/authMiddleware');

// --- ROUTES ---

// Upsert Fee Structure (Create/Edit)
router.post('/', protect, adminOnly, feeStructureController.upsertStructure);

// Apply Fee Structure to Class
router.post('/apply/:classId', protect, adminOnly, feeStructureController.applyToClass);

// ✅ NEW: Get Structure (This was missing!)
// This allows the frontend to fetch current fees before editing
router.get('/:classId', protect, feeStructureController.getStructureByClass);

// ✅ CORRECT EXPORT
module.exports = router;