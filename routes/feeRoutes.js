const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const protect = authMiddleware.protect || authMiddleware;

// Import the controller
const feeController = require('../controllers/feeController');

// --- SAFETY CHECKS ---
if (!feeController.collectFees) console.error("❌ collectFees is missing in controller!");
if (!feeController.getGlobalStats) console.error("❌ getGlobalStats is missing in controller!");

// --- 1. GLOBAL ANALYTICS (Must be at the top) ---
// This handles the request from your FinanceDashboard.jsx
router.get('/global-stats', protect, feeController.getGlobalStats);

// --- 2. MASTER PLAN PAYMENT ROUTES ---
router.post('/pay', protect, feeController.collectFees); 
router.get('/status/:studentId', protect, feeController.getFinanceStatus);

// --- 3. STANDARD/LEGACY ROUTES ---
router.post('/', protect, feeController.addFee);
router.get('/', protect, feeController.getFees);
router.get('/stats', protect, feeController.getFeeStats);
router.get('/student/:studentId', protect, feeController.getStudentFees);
// Add this with your other routes
router.get('/archive/2022/:studentId', protect, feeController.archive2022Data);
router.delete('/archive/2022/:studentId', protect, feeController.purge2022Data);
module.exports = router;