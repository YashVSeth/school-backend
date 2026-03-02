const LeaveRequest = require('../models/LeaveRequest');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const TeacherSalary = require('../models/TeacherSalary');

// 1. TEACHER: Apply for Leave
exports.applyLeave = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const { reason, startDate, endDate } = req.body;

        if (!reason || !startDate || !endDate) {
            return res.status(400).json({ message: "Reason, Start Date, and End Date are required" });
        }

        const newLeave = new LeaveRequest({
            teacher: teacherId,
            reason,
            startDate,
            endDate,
            status: 'Pending'
        });

        await newLeave.save();
        res.status(201).json({ message: "Leave request submitted successfully", leave: newLeave });
    } catch (error) {
        console.error("Apply Leave Error:", error);
        res.status(500).json({ message: "Failed to apply for leave" });
    }
};

// 2. TEACHER: Get My Leave History
exports.getMyLeaves = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const leaves = await LeaveRequest.find({ teacher: teacherId }).sort({ createdAt: -1 });
        res.status(200).json({ leaves });
    } catch (error) {
        console.error("Fetch Leaves Error:", error);
        res.status(500).json({ message: "Failed to fetch leave history" });
    }
};

// 3. ADMIN: Get All Leaves (Filterable by status)
exports.getAllLeaves = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) {
            query.status = status;
        }

        const leaves = await LeaveRequest.find(query)
            .populate('teacher', 'firstName lastName fullName')
            .sort({ createdAt: -1 });

        res.status(200).json({ leaves });
    } catch (error) {
        console.error("Fetch All Leaves Error:", error);
        res.status(500).json({ message: "Failed to fetch all leaves" });
    }
};

// 4. ADMIN: Update Leave Status (Approve/Decline)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Approved' or 'Declined'

        console.log(`[Leave Update Request] ID: ${id} | New Status: ${status} | Auth Role: ${req.user.role}`);

        if (!['Approved', 'Declined', 'Pending'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const leave = await LeaveRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).populate('teacher', 'firstName lastName fullName');

        if (!leave) {
            return res.status(404).json({ message: "Leave request not found" });
        }

        // --- AUTOMATIC SALARY DEDUCTION LOGIC ---
        if (status === 'Approved') {
            const teacherDoc = await Teacher.findById(leave.teacher);
            if (teacherDoc) {
                const baseSalary = teacherDoc.baseSalary || 0;

                // Calculate days of leave
                const t1 = new Date(leave.startDate).getTime();
                const t2 = new Date(leave.endDate).getTime();
                let days = Math.ceil((t2 - t1) / (1000 * 3600 * 24)) + 1;
                if (days < 1) days = 1;

                // Provide a basic daily rate (Gross / 30 days)
                const dailyRate = baseSalary / 30;
                const deductionAmount = Math.round(dailyRate * days);

                // Month String YYYY-MM
                const leaveMonth = new Date(leave.startDate).toISOString().slice(0, 7);

                // Insert deduction record
                await TeacherSalary.create({
                    teacherId: teacherDoc._id,
                    amountPaid: deductionAmount, // Technically "amount deducted" but stored in same column to hit balance ceiling
                    paymentType: 'Leave Deduction',
                    month: leaveMonth,
                    remarks: `System Auto-Deduction: Leave Approved (${days} days)`
                });
            }
        }

        res.status(200).json({ message: `Leave request ${status.toLowerCase()}`, leave });
    } catch (error) {
        console.error("Update Leave Status Error:", error);
        res.status(500).json({ message: "Failed to update leave status" });
    }
};
