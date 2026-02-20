const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice'); 

// ----------------------------------------------------------------
// 1. GET INVOICES FOR A STUDENT (UPDATED FOR NEW UI)
// ----------------------------------------------------------------
exports.getStudentInvoices = async (req, res) => {
    try {
        let query = { student: req.params.studentId };
        
        // If frontend DOES NOT ask for all, only show pending dues
        if (req.query.all !== 'true') {
            query.status = { $ne: 'Paid' };
        }

        const invoices = await Invoice.find(query).sort({ dueDate: 1 }); // Oldest first
        res.json(invoices);
    } catch (error) {
        console.error("Fetch Invoices Error:", error);
        res.status(500).json({ message: "Failed to fetch invoices" });
    }
};

// ----------------------------------------------------------------
// 2. PROCESS SHOPPING CART PAYMENT
// ----------------------------------------------------------------
exports.processCartPayment = async (req, res) => {
    try {
        const { studentId, amountPaid, paymentMethod, invoicesToPay } = req.body;
        let moneyLeftToDistribute = Number(amountPaid);

        if (!moneyLeftToDistribute || moneyLeftToDistribute <= 0) {
            return res.status(400).json({ message: "Invalid Payment Amount" });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        const invoices = await Invoice.find({ _id: { $in: invoicesToPay } }).sort({ dueDate: 1 });
        let paidInvoiceTitles = [];

        for (let inv of invoices) {
            if (moneyLeftToDistribute <= 0) break; 

            const pendingOnInvoice = inv.amount - inv.amountPaid;
            const paymentForThisInvoice = Math.min(pendingOnInvoice, moneyLeftToDistribute);

            inv.amountPaid += paymentForThisInvoice;
            moneyLeftToDistribute -= paymentForThisInvoice;
            
            if (inv.amountPaid >= inv.amount) {
                inv.status = 'Paid';
            } else {
                inv.status = 'Partially Paid';
            }

            paidInvoiceTitles.push(inv.title);
            await inv.save();
        }

        if (moneyLeftToDistribute > 0) {
            student.feeDetails = student.feeDetails || {};
            student.feeDetails.walletBalance = (student.feeDetails.walletBalance || 0) + moneyLeftToDistribute;
            student.markModified('feeDetails');
            await student.save();
            paidInvoiceTitles.push(`+ ₹${moneyLeftToDistribute} added to Wallet`);
        }

        const newTxn = new Transaction({
            student: studentId,
            amount: Number(amountPaid),
            monthsPaid: paidInvoiceTitles, 
            paymentMethod: paymentMethod || 'Cash',
            date: new Date(),
            academicYear: '2026-27'
        });
        await newTxn.save();

        res.json({ message: "Payment processed successfully!", transaction: newTxn });

    } catch (error) {
        console.error("Cart Payment Error:", error);
        res.status(500).json({ message: "Payment Processing Failed" });
    }
};

// ----------------------------------------------------------------
// 3. COLLECT FEES (Legacy)
// ----------------------------------------------------------------
exports.collectFees = async (req, res) => {
    try {
        const { studentId, amount, months, paymentMethod, category } = req.body;
        const payAmount = Number(amount);

        if (!payAmount || payAmount <= 0) {
            return res.status(400).json({ message: "Invalid Amount" });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        let details = student.feeDetails || {};

        if (category === 'Arrears 2024') {
            details.backlog_2024 = Math.max(0, (details.backlog_2024 || 0) - payAmount);
        } else if (category === 'Arrears 2025') {
            details.backlog_2025 = Math.max(0, (details.backlog_2025 || 0) - payAmount);
        } else if (category === 'Electrical') {
            details.electricalCharges = Math.max(0, (details.electricalCharges || 0) - payAmount);
        } else {
            student.feesPaid = (student.feesPaid || 0) + payAmount;
        }

        student.feeDetails = details;
        student.markModified('feeDetails'); 
        await student.save();

        const newTransaction = new Transaction({
            student: studentId,
            amount: payAmount,
            monthsPaid: category === 'Tuition' ? months : [category],
            paymentMethod: paymentMethod || 'Cash',
            date: new Date(),
            academicYear: '2026-27'
        });
        await newTransaction.save();
        
        res.json({
            message: `Payment applied to ${category} Successfully!`,
            amountPaid: payAmount,
            remainingDues: details
        });

    } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).json({ message: "Payment Failed" });
    }
};

// ----------------------------------------------------------------
// 4. GLOBAL STATS (✅ UPDATED TO SUPPORT CLASS FILTER)
// ----------------------------------------------------------------
exports.getGlobalStats = async (req, res) => {
    try {
        const { classId } = req.query; // ✅ Check if frontend sent a class filter

        // 1. Build the student query
        let studentQuery = { status: 'active' };
        if (classId) studentQuery.class = classId; // Filter by class if selected

        const students = await Student.find(studentQuery).populate('class');
        const studentIds = students.map(s => s._id);

        // 2. Build the transaction query (Only sum money collected from THESE students)
        let txMatch = {};
        if (classId) txMatch = { student: { $in: studentIds } };

        const totalCollectedResult = await Transaction.aggregate([
            { $match: txMatch },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalCollected = totalCollectedResult.length > 0 ? totalCollectedResult[0].total : 0;

        // 3. Calculate Dues
        const feeStructures = await FeeStructure.find({ academicYear: '2026-27' });
        const feeMap = {};
        feeStructures.forEach(fs => {
            if (fs.classId) {
                feeMap[fs.classId.toString()] = (fs.monthlyTuition * 12) + fs.admissionFee + fs.examFee;
            }
        });

        let totalArrears2024 = 0;
        let totalArrears2025 = 0;
        let totalCurrent2026 = 0;

        students.forEach(student => {
            if (student.class && student.class._id) {
                const cId = student.class._id.toString();
                const yearlyFee = feeMap[cId] || 0;

                totalArrears2024 += (student.feeDetails?.backlog_2024 || 0);
                totalArrears2025 += (student.feeDetails?.backlog_2025 || 0);
                
                const electrical = (student.feeDetails?.electricalCharges || 0);
                totalCurrent2026 += (yearlyFee + electrical); 
            }
        });

        const grandTotalDue = totalArrears2024 + totalArrears2025 + Math.max(0, totalCurrent2026 - (totalCollected * 0.5));

        res.json({
            grandTotalDue: Math.max(0, grandTotalDue),
            totalStudents: students.length,
            totalArrears2024, 
            totalArrears2025, 
            totalCurrent2026, 
            totalCollected
        });

    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Error calculating stats" });
    }
};

// ----------------------------------------------------------------
// 5. GET FINANCE STATUS (UPDATED FOR NEW ARRAYS)
// ----------------------------------------------------------------
exports.getFinanceStatus = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        const structure = await FeeStructure.findOne({ 
            classId: student.class._id, 
            academicYear: '2026-27' 
        });

        // ✅ Extract from new array schema, fallback to old schema, or 0
        let monthlyFee = 0;
        let admissionFee = 0;
        let examFee = 0;

        if (structure) {
            if (structure.mandatoryFees && structure.mandatoryFees.length > 0) {
                // Find specific fees in the array
                const tFee = structure.mandatoryFees.find(f => f.name.toLowerCase().includes('tuition'));
                const aFee = structure.mandatoryFees.find(f => f.name.toLowerCase().includes('admission'));
                const eFee = structure.mandatoryFees.find(f => f.name.toLowerCase().includes('exam'));
                
                monthlyFee = tFee ? tFee.amount : 0;
                admissionFee = aFee ? aFee.amount : 0;
                examFee = eFee ? eFee.amount : 0;
            } else {
                // Legacy fallback (in case you haven't saved a new structure yet)
                monthlyFee = structure.monthlyTuition || 0;
                admissionFee = structure.admissionFee || 0;
                examFee = structure.examFee || 0;
            }
        }

        const yearlyTotal = (monthlyFee * 12) + admissionFee + examFee;

        const currentBacklog = (student.feeDetails?.backlog_2024 || 0) + 
                               (student.feeDetails?.backlog_2025 || 0) + 
                               (student.feeDetails?.electricalCharges || 0);

        const totalPaid = student.feesPaid || 0;
        const walletBalance = student.feeDetails?.walletBalance || 0; 
        
        res.json({
            student: { firstName: student.firstName, lastName: student.lastName },
            structure: { monthlyTuition: monthlyFee, admissionFee: admissionFee, examFee: examFee },
            totalDue: currentBacklog + yearlyTotal,
            totalPaid: totalPaid,
            walletBalance: walletBalance,
            history: await Transaction.find({ student: student._id }).sort({ date: -1 })
        });

    } catch (error) {
        console.error("Status Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// ----------------------------------------------------------------
// 6. RESET DATA (Maintenance)
// ----------------------------------------------------------------
exports.resetFeeData = async (req, res) => {
    try {
        await Transaction.deleteMany({});
        await Invoice.deleteMany({}); 
        await Student.updateMany({}, { $set: { feesPaid: 0, "feeDetails.walletBalance": 0 } }); 
        res.json({ message: "History and Invoices Deleted." });
    } catch (error) {
        res.status(500).json({ message: "Reset Failed" });
    }
};

// ----------------------------------------------------------------
// 7. CREATE NEW INVOICE
// ----------------------------------------------------------------
exports.createInvoice = async (req, res) => {
    try {
        const { studentId, title, amount } = req.body;
        
        if (!title || !amount) {
            return res.status(400).json({ message: "Title and Amount are required" });
        }

        const newInvoice = new Invoice({
            student: studentId,
            title: title, 
            amount: Number(amount),
            dueDate: new Date()
        });
        
        await newInvoice.save();
        res.status(201).json({ message: "Bill Generated Successfully!", invoice: newInvoice });

    } catch (error) {
        console.error("Create Invoice Error:", error);
        res.status(500).json({ message: "Failed to generate bill" });
    }
};

// ----------------------------------------------------------------
// 8. BULK GENERATE MONTHLY BILLS (✅ UPDATED TO SUPPORT CLASS FILTER)
// ----------------------------------------------------------------
exports.generateMonthlyBills = async (req, res) => {
    try {
        const { monthTitle, defaultAmount, classId } = req.body;
        
        // ✅ Only find students in the specific class (or all if none provided)
        let query = { status: 'active' };
        if (classId) query.class = classId;

        const students = await Student.find(query);
        let newInvoicesCount = 0;

        for (let student of students) {
            const existingInvoice = await Invoice.findOne({ 
                student: student._id, 
                title: monthTitle 
            });

            if (!existingInvoice) {
                await Invoice.create({
                    student: student._id,
                    title: monthTitle,
                    amount: Number(defaultAmount),
                    dueDate: new Date()
                });
                newInvoicesCount++;
            }
        }

        const targetMessage = classId ? `the selected class` : `all classes`;
        res.json({ message: `Successfully generated ${newInvoicesCount} new bills for ${monthTitle} in ${targetMessage}!` });

    } catch (error) {
        console.error("Bulk Invoice Error:", error);
        res.status(500).json({ message: "Failed to generate bulk bills" });
    }
};
// ----------------------------------------------------------------
// 9. GET FEE STRUCTURE FOR A CLASS
// ----------------------------------------------------------------
exports.getFeeStructure = async (req, res) => {
    try {
        const structure = await FeeStructure.findOne({ 
            classId: req.params.classId, 
            academicYear: '2026-27' 
        });
        
        // If found, send it. If not, send empty arrays so frontend doesn't crash
        res.json(structure || { mandatoryFees: [], optionalFees: [] });
    } catch (error) {
        console.error("Fetch Structure Error:", error);
        res.status(500).json({ message: "Failed to fetch fee structure" });
    }
};

// ----------------------------------------------------------------
// 10. SAVE OR UPDATE FEE STRUCTURE
// ----------------------------------------------------------------
exports.saveFeeStructure = async (req, res) => {
    try {
        const { classId, mandatoryFees, optionalFees, academicYear } = req.body;

        // Check if a structure already exists for this class
        let structure = await FeeStructure.findOne({ classId, academicYear: academicYear || '2026-27' });

        if (structure) {
            // Update existing
            structure.mandatoryFees = mandatoryFees;
            structure.optionalFees = optionalFees;
            await structure.save();
        } else {
            // Create new
            structure = await FeeStructure.create({
                classId,
                mandatoryFees,
                optionalFees,
                academicYear: academicYear || '2026-27'
            });
        }

        res.json({ message: "Fee structure saved successfully!", structure });
    } catch (error) {
        console.error("Save Structure Error:", error);
        res.status(500).json({ message: "Failed to save fee structure" });
    }
};
// Placeholders
exports.addFee = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getFees = async (req, res) => { res.json([]); };
exports.getFeeStats = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getStudentFees = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.archive2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.purge2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };