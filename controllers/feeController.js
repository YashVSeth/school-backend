const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const Class = require('../models/Class');

// Helper to calculate annual multiplier for fee frequencies
const getFrequencyMultiplier = (frequency) => {
    if (!frequency) return 1;
    const f = frequency.toString().toUpperCase().trim();
    switch (f) {
        case 'MONTHLY': return 12;
        case 'QUARTERLY': return 4;
        case 'HALF-YEARLY':
        case 'HALFYEARLY':
        case 'HALF_YEARLY': return 2;
        case 'YEARLY':
        case 'ONE-TIME':
        case 'ONETIME':
        case 'ONE_TIME':
        default: return 1;
    }
};

// Helper to calculate annual total for a fee structure
const calculateStructureAnnual = (feeStructure) => {
    if (!feeStructure) return 0;
    let total = 0;
    (feeStructure.mandatoryFees || []).forEach(fee => {
        const mult = getFrequencyMultiplier(fee.frequency);
        total += (Number(fee.amount) || 0) * mult;
    });
    return total;
};

// ----------------------------------------------------------------
// 1. GET INVOICES FOR A STUDENT (With Full Status & Duplicate Guard)
// ----------------------------------------------------------------
exports.getStudentInvoices = async (req, res) => {
    try {
        let query = { student: req.params.studentId };
        const academicYear = req.query.academicYear || '2026-27';
        query.academicYear = academicYear;

        if (req.query.unpaidOnly === 'true') {
            query.status = { $ne: 'Paid' };
        }

        const invoices = await Invoice.find(query).sort({ dueDate: 1 }).lean();
        res.json(invoices);
    } catch (error) {
        console.error("Fetch Invoices Error:", error);
        res.status(500).json({ message: "Failed to fetch invoices" });
    }
};

// ----------------------------------------------------------------
// 2. PROCESS SHOPPING CART PAYMENT (Smart Waterfall Priority Settlement)
// ----------------------------------------------------------------
exports.processCartPayment = async (req, res) => {
    try {
        const { studentId, amountPaid, paymentMethod, invoicesToPay, remarks, clearArrears } = req.body;
        const totalToDistribute = Number(amountPaid);

        if (!totalToDistribute || totalToDistribute <= 0) {
            return res.status(400).json({ message: "Invalid Payment Amount" });
        }

        const student = await Student.findById(studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        let moneyLeftToDistribute = totalToDistribute;
        let paidInvoiceTitles = [];
        let paidInvoiceIds = [];
        let details = student.feeDetails || {};

        // 🌊 WATERFALL STEP 1: Settle Old Arrears first if requested or if past backlogs exist
        if (clearArrears || (!invoicesToPay || invoicesToPay.length === 0)) {
            if ((details.backlog_2024 || 0) > 0 && moneyLeftToDistribute > 0) {
                const pay24 = Math.min(details.backlog_2024, moneyLeftToDistribute);
                details.backlog_2024 -= pay24;
                moneyLeftToDistribute -= pay24;
                paidInvoiceTitles.push(`Arrears 2024 (₹${pay24})`);
            }
            if ((details.backlog_2025 || 0) > 0 && moneyLeftToDistribute > 0) {
                const pay25 = Math.min(details.backlog_2025, moneyLeftToDistribute);
                details.backlog_2025 -= pay25;
                moneyLeftToDistribute -= pay25;
                paidInvoiceTitles.push(`Arrears 2025 (₹${pay25})`);
            }
            if ((details.electricalCharges || 0) > 0 && moneyLeftToDistribute > 0) {
                const payElec = Math.min(details.electricalCharges, moneyLeftToDistribute);
                details.electricalCharges -= payElec;
                moneyLeftToDistribute -= payElec;
                paidInvoiceTitles.push(`Electrical Charges (₹${payElec})`);
            }
        }

        // 🌊 WATERFALL STEP 2: Settle Mandatory & Tuition Invoices with Per-Item Partial Payment Support
        const { itemBreakdown } = req.body; // Optional [{ invoiceId, amount }]
        const itemMap = {};
        if (Array.isArray(itemBreakdown)) {
            itemBreakdown.forEach(ib => {
                if (ib.invoiceId && ib.amount > 0) itemMap[ib.invoiceId.toString()] = Number(ib.amount);
            });
        }

        const invoices = await Invoice.find({ _id: { $in: invoicesToPay || [] } }).sort({ dueDate: 1 });

        for (let inv of invoices) {
            if (moneyLeftToDistribute <= 0) break;

            const pendingOnInvoice = Math.max(0, inv.amount - (inv.amountPaid || 0));
            if (pendingOnInvoice <= 0) continue;

            // If an explicit partial amount was specified for this invoice, use it; otherwise waterfall
            let targetForThis = itemMap[inv._id.toString()] !== undefined
                ? Math.min(itemMap[inv._id.toString()], pendingOnInvoice)
                : pendingOnInvoice;

            const paymentForThisInvoice = Math.min(targetForThis, moneyLeftToDistribute);
            if (paymentForThisInvoice <= 0) continue;

            inv.amountPaid = (inv.amountPaid || 0) + paymentForThisInvoice;
            moneyLeftToDistribute -= paymentForThisInvoice;

            if (inv.amountPaid >= inv.amount) {
                inv.status = 'Paid';
            } else {
                inv.status = 'Partially Paid';
            }

            paidInvoiceTitles.push(`${inv.title} (₹${paymentForThisInvoice}/${inv.amount})`);
            paidInvoiceIds.push(inv._id);
            await inv.save();
        }

        // Fallback title if nothing specific matched
        if (paidInvoiceTitles.length === 0) {
            paidInvoiceTitles.push(`Fee Payment`);
        }

        // 🌊 WATERFALL STEP 3: Surplus allocated to Advance Wallet
        if (moneyLeftToDistribute > 0) {
            details.walletBalance = (details.walletBalance || 0) + moneyLeftToDistribute;
            paidInvoiceTitles.push(`+ ₹${moneyLeftToDistribute} added to Wallet`);
        }

        // Synchronize student feesPaid
        student.feesPaid = (student.feesPaid || 0) + totalToDistribute;
        student.feeDetails = details;
        student.markModified('feeDetails');
        await student.save();

        // Generate official Receipt Number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const receiptNo = `REC-${dateStr}-${randomNum}`;

        const newTxn = new Transaction({
            receiptNo,
            student: studentId,
            amount: totalToDistribute,
            monthsPaid: paidInvoiceTitles,
            paymentMethod: paymentMethod || 'Cash',
            date: new Date(),
            academicYear: req.body.academicYear || '2026-27',
            invoices: paidInvoiceIds,
            remarks: remarks || ''
        });
        await newTxn.save();

        res.json({
            message: "Payment processed successfully!",
            receiptNo,
            transaction: newTxn,
            student: {
                _id: student._id,
                name: `${student.firstName} ${student.lastName || ''}`.trim(),
                studentId: student.studentId,
                rollNo: student.rollNo,
                grade: student.class?.grade || 'N/A',
                section: student.class?.section || '',
                phone: student.phone || '',
                fatherName: student.fatherName || ''
            }
        });

    } catch (error) {
        console.error("Cart Payment Error:", error);
        res.status(500).json({ message: "Payment Processing Failed" });
    }
};

// ----------------------------------------------------------------
// 3. COLLECT FEES (Direct Legacy/Quick Route)
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
        }

        student.feesPaid = (student.feesPaid || 0) + payAmount;
        student.feeDetails = details;
        student.markModified('feeDetails');
        await student.save();

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const receiptNo = `REC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newTransaction = new Transaction({
            receiptNo,
            student: studentId,
            amount: payAmount,
            monthsPaid: category === 'Tuition' ? months : [category || 'Fee Collection'],
            paymentMethod: paymentMethod || 'Cash',
            date: new Date(),
            academicYear: req.body.academicYear || '2026-27'
        });
        await newTransaction.save();

        res.json({
            message: `Payment applied to ${category || 'fees'} successfully!`,
            amountPaid: payAmount,
            receiptNo,
            remainingDues: details
        });

    } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).json({ message: "Payment Failed" });
    }
};

// ----------------------------------------------------------------
// 4. GLOBAL STATS
// ----------------------------------------------------------------
exports.getGlobalStats = async (req, res) => {
    try {
        const { classId } = req.query;
        const academicYear = req.query.academicYear || '2026-27';

        const allClasses = await Class.find({}).sort({ grade: 1 }).lean();

        let studentQuery = { status: 'active' };
        if (classId) studentQuery.class = classId;

        const students = await Student.find(studentQuery).populate('class', 'grade section').lean();
        const studentIds = students.map(s => s._id);

        let txMatch = { academicYear };
        if (classId) txMatch.student = { $in: studentIds };

        const [
            totalCollectedResult,
            lateFeeResult,
            feeStructures,
            monthlyAggregation,
            recentTransactions
        ] = await Promise.all([
            Transaction.aggregate([
                { $match: txMatch },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            Transaction.aggregate([
                { $match: { ...txMatch, monthsPaid: { $regex: /late fee|penalty/i } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            FeeStructure.find({ academicYear }).lean(),
            (() => {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
                sixMonthsAgo.setDate(1);
                sixMonthsAgo.setHours(0, 0, 0, 0);

                return Transaction.aggregate([
                    { $match: { ...txMatch, date: { $gte: sixMonthsAgo } } },
                    {
                        $group: {
                            _id: { month: { $month: "$date" }, year: { $year: "$date" } },
                            total: { $sum: "$amount" }
                        }
                    },
                    { $sort: { "_id.year": 1, "_id.month": 1 } }
                ]);
            })(),
            Transaction.find(txMatch)
                .sort({ date: -1 })
                .limit(10)
                .populate({
                    path: 'student',
                    select: 'firstName lastName studentId class feesPaid feeDetails',
                    populate: { path: 'class', select: 'grade section' }
                })
                .lean()
        ]);

        const totalCollected = totalCollectedResult.length > 0 ? totalCollectedResult[0].total : 0;
        const lateFeesCharged = lateFeeResult.length > 0 ? lateFeeResult[0].total : 0;

        const feeMap = {};
        feeStructures.forEach(fs => {
            if (fs.classId) {
                const cId = fs.classId.toString();
                feeMap[cId] = calculateStructureAnnual(fs);
            }
        });

        const studentPayments = await Transaction.aggregate([
            { $match: { academicYear, student: { $in: studentIds } } },
            { $group: { _id: "$student", total: { $sum: "$amount" } } }
        ]);
        const studentPaidMap = {};
        studentPayments.forEach(p => {
            studentPaidMap[p._id.toString()] = p.total;
        });

        const classBreakdown = {};
        allClasses.forEach(c => {
            classBreakdown[c._id.toString()] = {
                grade: c.grade,
                section: c.section || '',
                students: 0,
                annualFee: feeMap[c._id.toString()] || 0,
                totalExpected: 0,
                collected: 0,
                outstanding: 0,
                collectionRate: 100
            };
        });

        let grandTotalExpected = 0;
        let overdueCount = 0;
        let totalArrears2024 = 0;
        let totalArrears2025 = 0;
        let totalCurrent2026 = 0;

        students.forEach(student => {
            const cId = student.class?._id ? student.class._id.toString() : student.class?.toString();
            const yearlyFee = (cId && feeMap[cId]) ? feeMap[cId] : 0;
            const ar24 = student.feeDetails?.backlog_2024 || 0;
            const ar25 = student.feeDetails?.backlog_2025 || 0;
            const elec = student.feeDetails?.electricalCharges || 0;
            const transport = (student.feeDetails?.isUsingTransport ? (student.feeDetails.transportFee || 0) * 12 : 0);

            totalArrears2024 += ar24;
            totalArrears2025 += ar25;
            totalCurrent2026 += (yearlyFee + elec + transport);

            const totalStudentDue = ar24 + ar25 + elec + transport + yearlyFee;
            const studentPaid = studentPaidMap[student._id.toString()] || (student.feesPaid || 0);

            grandTotalExpected += totalStudentDue;

            const remainingBalance = Math.max(0, totalStudentDue - studentPaid);
            if (remainingBalance > 0) {
                overdueCount++;
            }

            if (cId && classBreakdown[cId]) {
                classBreakdown[cId].students += 1;
                classBreakdown[cId].totalExpected += totalStudentDue;
                classBreakdown[cId].collected += studentPaid;
            }
        });

        Object.keys(classBreakdown).forEach(cId => {
            const cb = classBreakdown[cId];
            cb.outstanding = Math.max(0, cb.totalExpected - cb.collected);
            cb.collectionRate = cb.totalExpected > 0
                ? Number(((cb.collected / cb.totalExpected) * 100).toFixed(1))
                : 100;
        });

        const grandTotalDue = Math.max(0, grandTotalExpected - totalCollected);

        const enrichedRecentTransactions = recentTransactions.map(txn => {
            if (txn.student && txn.student.class && txn.student.class._id) {
                const cId = txn.student.class._id.toString();
                const yearlyFee = feeMap[cId] || 0;
                const ar24 = txn.student.feeDetails?.backlog_2024 || 0;
                const ar25 = txn.student.feeDetails?.backlog_2025 || 0;
                const elec = txn.student.feeDetails?.electricalCharges || 0;
                const transport = (txn.student.feeDetails?.isUsingTransport ? (txn.student.feeDetails.transportFee || 0) * 12 : 0);

                const totalStudentDue = ar24 + ar25 + elec + transport + yearlyFee;
                const studentPaid = studentPaidMap[txn.student._id.toString()] || (txn.student.feesPaid || 0);

                txn.remainingBalance = Math.max(0, totalStudentDue - studentPaid);
            } else {
                txn.remainingBalance = 0;
            }
            return txn;
        });

        const monthsMap = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const collectionTrends = monthlyAggregation.map(item => ({
            name: `${monthsMap[item._id.month - 1]} ${item._id.year}`,
            month: monthsMap[item._id.month - 1],
            total: item.total
        }));

        res.json({
            grandTotalDue,
            totalStudents: students.length,
            overdueStudents: overdueCount,
            totalArrears2024,
            totalArrears2025,
            totalCurrent2026,
            totalCollected,
            lateFeesCharged,
            classBreakdown,
            recentTransactions: enrichedRecentTransactions,
            collectionTrends
        });

    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Error calculating stats" });
    }
};

// ----------------------------------------------------------------
// 5. DEFAULTERS & AGING ANALYSIS (New Automation Feature)
// ----------------------------------------------------------------
exports.getDefaulters = async (req, res) => {
    try {
        const academicYear = req.query.academicYear || '2026-27';
        const { minDays, classId } = req.query;

        let studentQuery = { status: 'active' };
        if (classId) studentQuery.class = classId;

        const [students, feeStructures, unpaidInvoices] = await Promise.all([
            Student.find(studentQuery).populate('class', 'grade section').lean(),
            FeeStructure.find({ academicYear }).lean(),
            Invoice.find({ status: { $ne: 'Paid' }, academicYear }).lean()
        ]);

        const feeMap = {};
        feeStructures.forEach(fs => {
            if (fs.classId) feeMap[fs.classId.toString()] = calculateStructureAnnual(fs);
        });

        const now = new Date();
        const defaulters = [];
        const agingBuckets = {
            tier1_30: { count: 0, total: 0 },   // 0-30 days
            tier2_60: { count: 0, total: 0 },   // 31-60 days
            tier3_90: { count: 0, total: 0 },   // 61-90 days
            tier4_above90: { count: 0, total: 0 } // >90 days
        };

        students.forEach(student => {
            const cId = student.class?._id ? student.class._id.toString() : student.class?.toString();
            const yearlyFee = (cId && feeMap[cId]) ? feeMap[cId] : 0;
            const ar24 = student.feeDetails?.backlog_2024 || 0;
            const ar25 = student.feeDetails?.backlog_2025 || 0;
            const elec = student.feeDetails?.electricalCharges || 0;
            const transport = (student.feeDetails?.isUsingTransport ? (student.feeDetails.transportFee || 0) * 12 : 0);

            const totalDue = ar24 + ar25 + elec + transport + yearlyFee;
            const paid = student.feesPaid || 0;
            const pendingAmount = Math.max(0, totalDue - paid);

            if (pendingAmount > 0) {
                // Find oldest unpaid invoice date or estimate from session start (April 1)
                const studentInvoices = unpaidInvoices.filter(i => i.student.toString() === student._id.toString());
                let oldestDueDate = new Date(now.getFullYear(), 3, 15); // Default: April 15th

                if (studentInvoices.length > 0) {
                    studentInvoices.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                    oldestDueDate = new Date(studentInvoices[0].dueDate);
                } else if (ar24 > 0 || ar25 > 0) {
                    oldestDueDate = new Date(now.getFullYear() - 1, 3, 1);
                }

                const diffTime = Math.max(0, now - oldestDueDate);
                const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // Bucket aggregation
                if (daysOverdue <= 30) {
                    agingBuckets.tier1_30.count++;
                    agingBuckets.tier1_30.total += pendingAmount;
                } else if (daysOverdue <= 60) {
                    agingBuckets.tier2_60.count++;
                    agingBuckets.tier2_60.total += pendingAmount;
                } else if (daysOverdue <= 90) {
                    agingBuckets.tier3_90.count++;
                    agingBuckets.tier3_90.total += pendingAmount;
                } else {
                    agingBuckets.tier4_above90.count++;
                    agingBuckets.tier4_above90.total += pendingAmount;
                }

                if (!minDays || daysOverdue >= Number(minDays)) {
                    const studentName = `${student.firstName} ${student.lastName || ''}`.trim();
                    const gradeName = student.class?.grade || 'Class';
                    const fatherName = student.fatherName || 'Parent';

                    // Formatted WhatsApp message draft
                    const whatsappMsg = `Dear ${fatherName}, this is a gentle reminder from Radhey Shyam Shikshan Sansthaan that school fee dues of ₹${pendingAmount.toLocaleString('en-IN')} for ${studentName} (${gradeName}) are overdue by ${daysOverdue} days. Please clear the pending dues at your earliest convenience. Thank you!`;

                    defaulters.push({
                        studentId: student.studentId,
                        _id: student._id,
                        name: studentName,
                        grade: gradeName,
                        section: student.class?.section || '',
                        fatherName,
                        phone: student.phone || '',
                        email: student.email || '',
                        pendingAmount,
                        daysOverdue,
                        oldestDueDate,
                        whatsappMsg
                    });
                }
            }
        });

        // Sort defaulters by highest pending amount / days overdue
        defaulters.sort((a, b) => b.daysOverdue - a.daysOverdue || b.pendingAmount - a.pendingAmount);

        res.json({
            totalDefaulters: defaulters.length,
            agingBuckets,
            defaulters
        });

    } catch (error) {
        console.error("Defaulters Error:", error);
        res.status(500).json({ message: "Failed to fetch defaulters list" });
    }
};

// ----------------------------------------------------------------
// 6. NO-DUES FEE CLEARANCE CERTIFICATE (New Automation Feature)
// ----------------------------------------------------------------
exports.getClearanceCertificate = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        const academicYear = req.query.academicYear || '2026-27';
        const structure = await FeeStructure.findOne({
            classId: student.class?._id || student.class,
            academicYear
        });

        const yearlyTotal = calculateStructureAnnual(structure);
        const ar24 = student.feeDetails?.backlog_2024 || 0;
        const ar25 = student.feeDetails?.backlog_2025 || 0;
        const elec = student.feeDetails?.electricalCharges || 0;
        const transport = (student.feeDetails?.isUsingTransport ? (student.feeDetails.transportFee || 0) * 12 : 0);

        const totalDue = ar24 + ar25 + elec + transport + yearlyTotal;
        const totalPaid = student.feesPaid || 0;
        const remaining = Math.max(0, totalDue - totalPaid);

        const isCleared = remaining === 0;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const certificateNo = `ND-${dateStr}-${student.studentId || student._id.toString().slice(-4)}`;

        res.json({
            isCleared,
            certificateNo,
            issuedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            student: {
                name: `${student.firstName} ${student.lastName || ''}`.trim(),
                studentId: student.studentId,
                rollNo: student.rollNo,
                grade: student.class?.grade || 'N/A',
                fatherName: student.fatherName || 'N/A',
                motherName: student.motherName || 'N/A'
            },
            financialSummary: {
                totalDue,
                totalPaid,
                remainingBalance: remaining,
                academicYear
            },
            statusMessage: isCleared
                ? "All academic and institutional fee dues have been verified and settled in full."
                : `Student has an outstanding fee balance of ₹${remaining.toLocaleString('en-IN')}. Clearance cannot be issued.`
        });

    } catch (error) {
        console.error("Clearance Error:", error);
        res.status(500).json({ message: "Failed to generate clearance certificate" });
    }
};

// ----------------------------------------------------------------
// 7. GET FINANCE STATUS FOR A STUDENT
// ----------------------------------------------------------------
exports.getFinanceStatus = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId).populate('class');
        if (!student) return res.status(404).json({ message: "Student not found" });

        const academicYear = req.query.academicYear || '2026-27';
        const structure = await FeeStructure.findOne({
            classId: student.class?._id || student.class,
            academicYear
        });

        let yearlyTotal = 0;
        let monthlyFee = 0;
        let admissionFee = 0;
        let examFee = 0;

        if (structure) {
            yearlyTotal = calculateStructureAnnual(structure);
            const tFee = (structure.mandatoryFees || []).find(f => f.name.toLowerCase().includes('tuition'));
            const aFee = (structure.mandatoryFees || []).find(f => f.name.toLowerCase().includes('admission'));
            const eFee = (structure.mandatoryFees || []).find(f => f.name.toLowerCase().includes('exam'));

            monthlyFee = tFee ? tFee.amount : 0;
            admissionFee = aFee ? aFee.amount : 0;
            examFee = eFee ? eFee.amount : 0;
        }

        const currentBacklog = (student.feeDetails?.backlog_2024 || 0) +
            (student.feeDetails?.backlog_2025 || 0) +
            (student.feeDetails?.electricalCharges || 0);

        const totalPaid = student.feesPaid || 0;
        const walletBalance = student.feeDetails?.walletBalance || 0;

        const transactions = await Transaction.find({ student: student._id }).sort({ date: -1 }).lean();

        res.json({
            student: { firstName: student.firstName, lastName: student.lastName, studentId: student.studentId },
            structure: { monthlyTuition: monthlyFee, admissionFee: admissionFee, examFee: examFee, yearlyTotal },
            totalDue: currentBacklog + yearlyTotal,
            totalPaid: totalPaid,
            walletBalance: walletBalance,
            history: transactions
        });

    } catch (error) {
        console.error("Status Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

// ----------------------------------------------------------------
// 8. RESET DATA (Maintenance)
// ----------------------------------------------------------------
exports.resetFeeData = async (req, res) => {
    try {
        await Promise.all([
            Transaction.deleteMany({}),
            Invoice.deleteMany({}),
            Student.updateMany({}, { $set: { feesPaid: 0, "feeDetails.walletBalance": 0 } })
        ]);
        res.json({ message: "Fee history and invoices reset successfully." });
    } catch (error) {
        res.status(500).json({ message: "Reset Failed" });
    }
};

// ----------------------------------------------------------------
// 9. CREATE NEW INVOICE
// ----------------------------------------------------------------
exports.createInvoice = async (req, res) => {
    try {
        const { studentId, title, amount, academicYear } = req.body;
        const year = academicYear || '2026-27';

        if (!title || amount === undefined || amount === null) {
            return res.status(400).json({ message: "Title and Amount are required" });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        // Check if an unpaid invoice already exists for this title and academic year
        const existingInvoice = await Invoice.findOne({
            student: studentId,
            title: title.trim(),
            academicYear: year,
            status: { $ne: 'Paid' }
        });

        if (existingInvoice) {
            return res.status(200).json({ message: "Existing invoice found.", invoice: existingInvoice });
        }

        const newInvoice = new Invoice({
            student: studentId,
            title: title.trim(),
            amount: Number(amount) || 0,
            dueDate: new Date(),
            academicYear: year
        });

        await newInvoice.save();
        res.status(201).json({ message: "Bill Generated Successfully!", invoice: newInvoice });

    } catch (error) {
        console.error("Create Invoice Error:", error);
        res.status(500).json({ message: "Failed to generate bill" });
    }
};

// ----------------------------------------------------------------
// 10. BULK GENERATE MONTHLY BILLS
// ----------------------------------------------------------------
exports.generateMonthlyBills = async (req, res) => {
    try {
        const { monthTitle, defaultAmount, classId } = req.body;
        const academicYear = req.body.academicYear || '2026-27';

        let query = { status: 'active' };
        if (classId) query.class = classId;

        const [students, allStructures] = await Promise.all([
            Student.find(query).select('_id class').lean(),
            FeeStructure.find({ academicYear }).lean()
        ]);

        const structureMap = {};
        allStructures.forEach(fs => {
            if (fs.classId) {
                let monthlySum = 0;
                (fs.mandatoryFees || []).forEach(fee => {
                    if (fee.frequency === 'MONTHLY') monthlySum += fee.amount;
                });
                structureMap[fs.classId.toString()] = monthlySum;
            }
        });

        const existingInvoices = await Invoice.find({
            student: { $in: students.map(s => s._id) },
            title: monthTitle
        }).select('student').lean();

        const alreadyInvoiced = new Set(existingInvoices.map(i => i.student.toString()));
        const newInvoices = [];

        for (let student of students) {
            if (alreadyInvoiced.has(student._id.toString())) continue;

            const studentClassId = student.class ? student.class.toString() : '';
            const specificMonthlyFee = structureMap[studentClassId] !== undefined
                ? structureMap[studentClassId]
                : Number(defaultAmount || 0);

            if (specificMonthlyFee <= 0) continue;

            newInvoices.push({
                student: student._id,
                title: monthTitle,
                amount: specificMonthlyFee,
                dueDate: new Date(),
                academicYear
            });
        }

        if (newInvoices.length > 0) {
            await Invoice.insertMany(newInvoices);
        }

        const targetMessage = classId ? `the selected class` : `all classes`;
        res.json({
            message: `Successfully generated ${newInvoices.length} new bills for ${monthTitle} in ${targetMessage}!`,
            generatedCount: newInvoices.length
        });

    } catch (error) {
        console.error("Bulk Invoice Error:", error);
        res.status(500).json({ message: "Failed to generate bulk bills" });
    }
};

// ----------------------------------------------------------------
// 11. EXPORT MONTHLY REPORT
// ----------------------------------------------------------------
exports.exportMonthlyReport = async (req, res) => {
    try {
        const { year, month } = req.query;
        const academicYear = req.query.academicYear || '2026-27';

        let query = {};
        if (year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        } else {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            query.date = { $gte: startOfMonth };
        }

        const [allTransactions, feeStructures] = await Promise.all([
            Transaction.find(query)
                .sort({ date: -1 })
                .populate({
                    path: 'student',
                    select: 'firstName lastName studentId class feesPaid feeDetails',
                    populate: { path: 'class', select: 'grade section' }
                })
                .lean(),
            FeeStructure.find({ academicYear }).lean()
        ]);

        const feeMap = {};
        feeStructures.forEach(fs => {
            if (fs.classId) {
                feeMap[fs.classId.toString()] = calculateStructureAnnual(fs);
            }
        });

        const mappedTransactions = allTransactions.map(txn => {
            if (txn.student && txn.student.class && txn.student.class._id) {
                const cId = txn.student.class._id.toString();
                const yearlyFee = feeMap[cId] || 0;
                const ar24 = txn.student.feeDetails?.backlog_2024 || 0;
                const ar25 = txn.student.feeDetails?.backlog_2025 || 0;
                const elec = txn.student.feeDetails?.electricalCharges || 0;

                const totalDues = ar24 + ar25 + elec + yearlyFee;
                const totalPaid = txn.student.feesPaid || 0;

                txn.remainingBalance = Math.max(0, totalDues - totalPaid);
            } else {
                txn.remainingBalance = 0;
            }
            return txn;
        });

        res.json(mappedTransactions);

    } catch (error) {
        console.error("Export Report Error:", error);
        res.status(500).json({ message: "Failed to generate report data" });
    }
};

// ----------------------------------------------------------------
// 12. GET FEE STRUCTURE FOR A CLASS (Legacy Compatibility)
// ----------------------------------------------------------------
exports.getFeeStructure = async (req, res) => {
    try {
        const structure = await FeeStructure.findOne({
            classId: req.params.classId,
            academicYear: req.query.academicYear || '2026-27'
        });
        res.json(structure || { mandatoryFees: [], optionalFees: [] });
    } catch (error) {
        console.error("Fetch Structure Error:", error);
        res.status(500).json({ message: "Failed to fetch fee structure" });
    }
};

// ----------------------------------------------------------------
// 13. SAVE OR UPDATE FEE STRUCTURE (Legacy Compatibility)
// ----------------------------------------------------------------
exports.saveFeeStructure = async (req, res) => {
    try {
        const { classId, mandatoryFees, optionalFees, academicYear } = req.body;
        const year = academicYear || '2026-27';

        let structure = await FeeStructure.findOne({ classId, academicYear: year });

        if (structure) {
            structure.mandatoryFees = mandatoryFees;
            structure.optionalFees = optionalFees;
            await structure.save();
        } else {
            structure = await FeeStructure.create({
                classId,
                mandatoryFees,
                optionalFees,
                academicYear: year
            });
        }

        res.json({ message: "Fee structure saved successfully!", structure });
    } catch (error) {
        console.error("Save Structure Error:", error);
        res.status(500).json({ message: "Failed to save fee structure" });
    }
};

// Compatibility Stubs
exports.addFee = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getFees = async (req, res) => { res.json([]); };
exports.getFeeStats = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.getStudentFees = async (req, res) => {
    try {
        const transactions = await Transaction.find({ student: req.params.studentId })
            .sort({ date: -1 })
            .limit(10)
            .lean();
        res.json(transactions);
    } catch (error) {
        console.error("Get Student Fees Error:", error);
        res.status(500).json({ message: "Failed to fetch student fees" });
    }
};
exports.archive2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };
exports.purge2022Data = async (req, res) => { res.json({ message: "Placeholder" }); };