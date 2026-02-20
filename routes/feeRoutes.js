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
router.get('/global-stats', protect, feeController.getGlobalStats);

// --- 2. MASTER PLAN PAYMENT ROUTES (VERSION 1) ---
router.post('/pay', protect, feeController.collectFees); 
router.get('/status/:studentId', protect, feeController.getFinanceStatus);

// ✅ --- 2.5 NEW VERSION 2.0 "CART & INVOICE" ROUTES ---
router.get('/invoices/:studentId', protect, feeController.getStudentInvoices); // Fetch bills
router.post('/invoices', protect, feeController.createInvoice); // Creates a single bill (Quick Add / Not Due)
router.post('/invoices/bulk', protect, feeController.generateMonthlyBills); // Generates bills for whole class
router.post('/pay-cart', protect, feeController.processCartPayment); // Checkout terminal

// ✅ ADD THIS LINE FOR THE DELETE BUTTON TO WORK:
router.delete('/reset', protect, feeController.resetFeeData);

// --- 3. STANDARD/LEGACY ROUTES ---
router.post('/', protect, feeController.addFee);
router.get('/', protect, feeController.getFees);
router.get('/stats', protect, feeController.getFeeStats);
router.get('/student/:studentId', protect, feeController.getStudentFees);

router.get('/archive/2022/:studentId', protect, feeController.archive2022Data);
router.delete('/archive/2022/:studentId', protect, feeController.purge2022Data);
// --- FEE STRUCTURE SETUP ROUTES ---
router.get('/structure/:classId', protect, feeController.getFeeStructure); 
router.post('/structure', protect, feeController.saveFeeStructure);
module.exports = router;