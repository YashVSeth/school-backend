const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Transaction = require('../models/Transaction');

// ----------------------------------------------------------------
// 1. GET FINANCE STATUS (For Student Card)
// ----------------------------------------------------------------
exports.getFinanceStatus = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Use classId to match your schema
        const structure = await FeeStructure.findOne({ 
            classId: student.class._id, 
            academicYear: '2026-27' 
        });

        const monthlyFee = structure ? structure.monthlyTuition : 0;
        const admissionFee = structure ? structure.admissionFee : 0;
        const examFee = structure ? structure.examFee : 0;
        const yearlyTotal = structure ? (monthlyFee * 12) + admissionFee + examFee : 0;

        const totalPaid = student.feesPaid || 0;
        const currentOutstanding = Math.max(0, yearlyTotal - totalPaid);

        const history = await Transaction.find({ student: student._id }).sort({ date: -1 });

        res.json({
            student: {
                firstName: student.firstName,
                lastName: student.lastName,
                id: student._id
            },
            structure: {
                monthlyTuition: monthlyFee,
                admissionFee: admissionFee,
                yearlyTotal: yearlyTotal
            },
            totalDue: currentOutstanding,
            history: history.map(t => ({
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
// 2. COLLECT FEES (Process Payment)
// ----------------------------------------------------------------
exports.collectFees = async (req, res) => {
    try {
        const { studentId, amount, months } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid Amount" });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        const newTransaction = new Transaction({
            student: studentId,
            amount: Number(amount),
            monthsPaid: months || [],
            date: new Date(),
            academicYear: '2026-27'
        });

        await newTransaction.save();

        student.feesPaid = (student.feesPaid || 0) + Number(amount);
        await student.save();
        
        res.json({
            message: "Payment Successful",
            updatedFees: { totalDue: 0 } 
        });

    } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).json({ message: "Payment Failed" });
    }
};

// ----------------------------------------------------------------
// 3. PLACEHOLDERS (Required to prevent server crash)
// ----------------------------------------------------------------

// Needed for router.get('/global-stats', ...)
exports.getGlobalStats = async (req, res) => {
    res.json({ totalCollected: 0, pendingDues: 0 });
};

// Needed for router.post('/', ...)
exports.addFee = async (req, res) => {
    res.json({ message: "Fee added (Placeholder)" });
};

// Needed for router.get('/', ...)
exports.getFees = async (req, res) => {
    res.json([]); 
};

// Needed for router.get('/stats', ...)
exports.getFeeStats = async (req, res) => {
    res.json({ message: "Stats placeholder" });
};

// Needed for router.get('/student/:studentId', ...)
exports.getStudentFees = async (req, res) => {
    res.json({ message: "Student fees placeholder" });
};

// Needed for router.get('/archive/2022/:studentId', ...)
exports.archive2022Data = async (req, res) => {
    res.json({ message: "Archive placeholder" });
};

// Needed for router.delete('/archive/2022/:studentId', ...)
exports.purge2022Data = async (req, res) => {
    res.json({ message: "Purge placeholder" });
};