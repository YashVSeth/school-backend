const express = require('express');
const router = express.Router();
const TeacherSalary = require('../models/TeacherSalary');
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/authMiddleware');

// 1. GET /api/salary/history/:teacherId
// Fetch historical salary payments for a specific teacher
router.get('/history/:teacherId', protect, async (req, res) => {
    try {
        const { teacherId } = req.params;
        const history = await TeacherSalary.find({ teacherId }).sort({ paymentDate: -1 });
        res.json(history);
    } catch (error) {
        console.error("GET Teacher Salary err:", error);
        res.status(500).json({ message: "Failed to fetch salary history" });
    }
});

// 2. POST /api/salary/pay
// Record a new salary payment (Full or Partial)
router.post('/pay', protect, async (req, res) => {
    try {
        const { teacherId, amountPaid, paymentType, month, remarks } = req.body;

        if (!teacherId || !amountPaid || !paymentType || !month) {
            return res.status(400).json({ message: "Missing required salary fields" });
        }

        const numericAmount = Number(amountPaid);
        if (numericAmount <= 0) return res.status(400).json({ message: "Amount must be greater than zero." });

        if (paymentType !== 'Bonus') {
            const teacher = await Teacher.findById(teacherId);
            if (!teacher) return res.status(404).json({ message: "Teacher not found" });

            const baseSalary = teacher.baseSalary || 0;

            // Find all PAST non-bonus payments for this teacher in this exact month
            const pastPayments = await TeacherSalary.find({
                teacherId,
                month,
                paymentType: { $ne: 'Bonus' }
            });

            const sumPaid = pastPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);
            const remainingBalance = baseSalary - sumPaid;

            if (numericAmount > remainingBalance) {
                return res.status(400).json({
                    message: `Overpayment Error: This teacher's base salary is ₹${baseSalary}. They have already been paid ₹${sumPaid} this month. The remaining balance is ₹${remainingBalance}.`
                });
            }
        }

        const newPayment = await TeacherSalary.create({
            teacherId,
            amountPaid: numericAmount,
            paymentType,
            month,
            remarks
        });

        res.status(201).json({ message: "Salary payment recorded successfully!", record: newPayment });
    } catch (error) {
        console.error("POST Pay Salary err:", error);
        res.status(500).json({ message: "Failed to process salary payment" });
    }
});

module.exports = router;
