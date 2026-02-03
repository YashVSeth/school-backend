const express = require('express');
const router = express.Router();

// --- 1. Middleware Import ---
const authMiddleware = require('../middleware/authMiddleware');
// robust check to handle different export styles
const protect = authMiddleware.protect || authMiddleware;

// --- 2. Controller Imports ---
const { 
  addFee, 
  getFees, 
  getFeeStats, 
  getStudentFees 
} = require('../controllers/feeController');

// --- 3. Safety Checks ---
if (!protect) console.error("❌ Auth Middleware Missing");
if (!addFee) console.error("❌ Controller 'addFee' Missing");
if (!getStudentFees) console.error("❌ Controller 'getStudentFees' Missing");

// --- 4. Routes ---
router.post('/', protect, addFee);                 // Add new fee
router.get('/', protect, getFees);                 // Get all fees
router.get('/stats', protect, getFeeStats);        // Get stats
router.get('/student/:studentId', protect, getStudentFees); // Get specific student history

module.exports = router;