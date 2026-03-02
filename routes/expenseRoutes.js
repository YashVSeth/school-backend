const express = require('express');
const router = express.Router();
const { addExpense, getExpenses, getExpenseStats, deleteExpense } = require('../controllers/expenseController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, adminOnly, addExpense)
    .get(protect, adminOnly, getExpenses);

router.route('/stats')
    .get(protect, adminOnly, getExpenseStats);

router.route('/:id')
    .delete(protect, adminOnly, deleteExpense);

module.exports = router;
