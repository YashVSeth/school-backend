const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Transaction = require('../models/Transaction');

// ----------------------------------------------------------------
// 1. GET FINANCE STATUS (Calculates Total Paid from Transactions)
// ----------------------------------------------------------------
exports.getFinanceStatus = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        // 1. Get Fee Structure
        const structure = await FeeStructure.findOne({ 
            classId: student.class._id, 
            academicYear: '2026-27' 
        });

        const monthlyFee = structure ? structure.monthlyTuition : 0;
        const admissionFee = structure ? structure.admissionFee : 0;
        const examFee = structure ? structure.examFee : 0;
        const yearlyTotal = structure ? (monthlyFee * 12) + admissionFee + examFee : 0;

        // 2. ✅ FIXED: Calculate Total Paid by summing up ALL Transactions
        // This ensures the amount always decreases after payment
        const allTransactions = await Transaction.find({ student: student._id }).sort({ date: -1 });
        const totalPaid = allTransactions.reduce((acc, curr) => acc + curr.amount, 0);

        // 3. Calculate Outstanding
        const currentOutstanding = Math.max(0, yearlyTotal - totalPaid);

        // 4. Send Response
        res.json({
            student: {
                firstName: student.firstName,
                lastName: student.lastName,
                id: student._id
            },
            structure: {
                monthlyTuition: monthlyFee,
                admissionFee: admissionFee,
                examFee: examFee,
                yearlyTotal: yearlyTotal
            },
            totalDue: currentOutstanding, // This will now update correctly
            totalPaid: totalPaid,
            history: allTransactions.map(t => ({
                amount: t.amount,
                date: t.date,
                months: t.monthsPaid
            }))
        });

    } catch (error) {
        console.error("Status Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// ----------------------------------------------------------------
// 2. COLLECT FEES (Saves Transaction)
// ----------------------------------------------------------------
exports.collectFees = async (req, res) => {
    try {
        const { studentId, amount, months } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid Amount" });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        // 1. Create Transaction
        const newTransaction = new Transaction({
            student: studentId,
            amount: Number(amount),
            monthsPaid: months || [],
            date: new Date(),
            academicYear: '2026-27'
        });

        await newTransaction.save();

        // Note: We don't need to manually update student.feesPaid anymore
        // because getFinanceStatus calculates it dynamically now.
        
        res.json({
            message: "Payment Successful",
            amountPaid: amount
        });

    } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).json({ message: "Payment Failed" });
    }
};

// ----------------------------------------------------------------
// 3. RESET SYSTEM (DANGER: Deletes all history)
// ----------------------------------------------------------------
exports.resetFeeData = async (req, res) => {
    try {
        // Delete all transactions
        await Transaction.deleteMany({});
        
        // Reset student fee flags if you have them (optional but good practice)
        await Student.updateMany({}, { $set: { feesPaid: 0 } });

        res.json({ message: "System Reset Successful! History is now 0." });
    } catch (error) {
        console.error("Reset Error:", error);
        res.status(500).json({ message: "Reset Failed" });
    }
};

// ----------------------------------------------------------------
// 4. PLACEHOLDERS (To prevent crashes)
// ----------------------------------------------------------------
exports.getGlobalStats = async (req, res) => { res.json({ totalCollected: 0, pendingDues: 0 }); };
exports.addFee = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getFees = async (req, res) => { res.json([]); };
exports.getFeeStats = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getStudentFees = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.archive2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.purge2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };