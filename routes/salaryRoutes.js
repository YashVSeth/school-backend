const express = require('express');
const router = express.Router();
const TeacherSalary = require('../models/TeacherSalary');
const Teacher = require('../models/Teacher');
const TeacherAttendance = require('../models/TeacherAttendance');
const { protect, adminOnly } = require('../middleware/authMiddleware');

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

// 2. GET /api/salary/prorated-summary
// Calculate attendance-adjusted prorated salary for all teachers in a specific month
router.get('/prorated-summary', protect, adminOnly, async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const [yearStr, monthStr] = month.split('-');
        const year = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        // 1. Fetch all teachers
        const teachers = await Teacher.find({}).sort({ fullName: 1 }).select('fullName email phone baseSalary specialization highestQualification');

        // 2. Fetch all attendance records for this month
        const attendanceRecords = await TeacherAttendance.find({
            date: { $regex: new RegExp(`^${month}`) }
        });

        // 3. Fetch all salary payments for this month (excluding bonuses)
        const salaryPayments = await TeacherSalary.find({
            month,
            paymentType: { $ne: 'Bonus' }
        });

        // Map attendance by teacher
        const attMap = {};
        attendanceRecords.forEach(rec => {
            const tid = rec.teacherId ? rec.teacherId.toString() : '';
            if (!tid) return;
            if (!attMap[tid]) {
                attMap[tid] = { present: 0, absent: 0, halfDay: 0, onLeave: 0 };
            }
            if (rec.status === 'Present') attMap[tid].present++;
            else if (rec.status === 'Absent') attMap[tid].absent++;
            else if (rec.status === 'Half Day') attMap[tid].halfDay++;
            else if (rec.status === 'On Leave') attMap[tid].onLeave++;
        });

        // Map payments by teacher
        const paidMap = {};
        salaryPayments.forEach(rec => {
            const tid = rec.teacherId ? rec.teacherId.toString() : '';
            if (!tid) return;
            paidMap[tid] = (paidMap[tid] || 0) + (rec.amountPaid || 0);
        });

        let totalCommitment = 0;
        let totalDeductions = 0;
        let totalNetPayable = 0;
        let totalDisbursed = 0;
        let totalPending = 0;

        const teacherList = teachers.map(t => {
            const tid = t._id.toString();
            const baseSalary = t.baseSalary || 0;
            const att = attMap[tid] || { present: 0, absent: 0, halfDay: 0, onLeave: 0 };
            const effectiveAbsent = att.absent + (att.halfDay * 0.5);
            const dailyRate = daysInMonth > 0 ? (baseSalary / daysInMonth) : 0;
            const attendanceDeduction = Math.round(effectiveAbsent * dailyRate);
            const netPayable = Math.max(0, baseSalary - attendanceDeduction);
            const paidAmount = paidMap[tid] || 0;
            const remainingBalance = Math.max(0, netPayable - paidAmount);
            const unproratedBalance = Math.max(0, baseSalary - paidAmount);

            totalCommitment += baseSalary;
            totalDeductions += attendanceDeduction;
            totalNetPayable += netPayable;
            totalDisbursed += paidAmount;
            totalPending += remainingBalance;

            let status = 'Unset';
            if (baseSalary > 0) {
                if (paidAmount >= netPayable) status = 'Fully Paid';
                else if (paidAmount > 0) status = 'Partial';
                else status = 'Unpaid';
            }

            return {
                teacherId: t._id,
                fullName: t.fullName,
                email: t.email,
                phone: t.phone,
                specialization: t.specialization,
                highestQualification: t.highestQualification,
                baseSalary,
                daysInMonth,
                dailyRate: Math.round(dailyRate),
                presentDays: att.present,
                absentDays: att.absent,
                halfDays: att.halfDay,
                leaveDays: att.onLeave,
                effectiveAbsent,
                attendanceDeduction,
                netPayable,
                paidAmount,
                remainingBalance,
                unproratedBalance,
                status
            };
        });

        res.json({
            month,
            daysInMonth,
            stats: {
                totalCommitment,
                totalDeductions,
                totalNetPayable,
                totalDisbursed,
                totalPending,
                staffCount: teachers.length
            },
            teachers: teacherList
        });
    } catch (error) {
        console.error("GET Prorated Summary err:", error);
        res.status(500).json({ message: "Failed to calculate prorated payroll" });
    }
});

// 3. POST /api/salary/pay
// Record a new salary payment (Full, Partial, Prorated, or Bonus)
router.post('/pay', protect, adminOnly, async (req, res) => {
    try {
        const { teacherId, amountPaid, paymentType, month, remarks, attendanceDeduction, effectiveAbsentDays } = req.body;

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
            attendanceDeduction: Number(attendanceDeduction) || 0,
            effectiveAbsentDays: Number(effectiveAbsentDays) || 0,
            remarks
        });

        res.status(201).json({ message: "Salary payment recorded successfully!", record: newPayment });
    } catch (error) {
        console.error("POST Pay Salary err:", error);
        res.status(500).json({ message: "Failed to process salary payment" });
    }
});

module.exports = router;
