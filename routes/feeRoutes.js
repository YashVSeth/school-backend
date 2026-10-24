const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const protect = authMiddleware.protect || authMiddleware;

// Import the controller
const feeController = require('../controllers/feeController');

// --- 1. GLOBAL ANALYTICS & AUTOMATION ---
router.get('/global-stats', protect, feeController.getGlobalStats);
router.get('/monthly-report', protect, feeController.exportMonthlyReport);
router.get('/defaulters', protect, feeController.getDefaulters);
router.get('/clearance/:studentId', protect, feeController.getClearanceCertificate);

// --- 2. MASTER PLAN PAYMENT ROUTES ---
router.post('/pay', protect, feeController.collectFees);
router.get('/status/:studentId', protect, feeController.getFinanceStatus);

// --- 2.5 CART & INVOICE ROUTES ---
router.get('/invoices/:studentId', protect, feeController.getStudentInvoices);
router.post('/invoices', protect, feeController.createInvoice);
router.post('/invoices/bulk', protect, feeController.generateMonthlyBills);
router.post('/pay-cart', protect, feeController.processCartPayment);

// --- 3. MAINTENANCE & SETUP ---
router.delete('/reset', protect, feeController.resetFeeData);
router.get('/structure/:classId', protect, feeController.getFeeStructure);
router.post('/structure', protect, feeController.saveFeeStructure);

// --- 4. LEGACY / STUB ROUTES ---
router.post('/', protect, feeController.addFee);
router.get('/', protect, feeController.getFees);
router.get('/stats', protect, feeController.getFeeStats);
router.get('/student/:studentId', protect, feeController.getStudentFees);
router.get('/archive/2022/:studentId', protect, feeController.archive2022Data);
router.delete('/archive/2022/:studentId', protect, feeController.purge2022Data);

module.exports = router;