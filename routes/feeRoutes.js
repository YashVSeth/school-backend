const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Import the controller
const feeController = require('../controllers/feeController');

// --- 1. GLOBAL ANALYTICS & AUTOMATION ---
router.get('/global-stats', protect, adminOnly, feeController.getGlobalStats);
router.get('/monthly-report', protect, adminOnly, feeController.exportMonthlyReport);
router.get('/defaulters', protect, adminOnly, feeController.getDefaulters);
router.get('/clearance/:studentId', protect, feeController.getClearanceCertificate);

// --- 2. MASTER PLAN PAYMENT ROUTES ---
router.post('/pay', protect, adminOnly, feeController.collectFees);
router.get('/status/:studentId', protect, feeController.getFinanceStatus);

// --- 2.5 CART & INVOICE ROUTES ---
router.get('/invoices/:studentId', protect, feeController.getStudentInvoices);
router.post('/invoices', protect, adminOnly, feeController.createInvoice);
router.post('/invoices/bulk', protect, adminOnly, feeController.generateMonthlyBills);
router.post('/pay-cart', protect, adminOnly, feeController.processCartPayment);

// --- 3. MAINTENANCE & SETUP ---
router.delete('/reset', protect, adminOnly, feeController.resetFeeData);
router.get('/structure/:classId', protect, feeController.getFeeStructure);
router.post('/structure', protect, adminOnly, feeController.saveFeeStructure);

// --- 4. LEGACY / STUB ROUTES ---
router.post('/', protect, adminOnly, feeController.addFee);
router.get('/', protect, feeController.getFees);
router.get('/stats', protect, feeController.getFeeStats);
router.get('/student/:studentId', protect, feeController.getStudentFees);
router.get('/archive/2022/:studentId', protect, feeController.archive2022Data);
router.delete('/archive/2022/:studentId', protect, adminOnly, feeController.purge2022Data);

module.exports = router;