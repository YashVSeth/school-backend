const LeaveRequest = require('../models/LeaveRequest');
const Class = require('../models/Class');

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

        res.status(200).json({ message: `Leave request ${status.toLowerCase()}`, leave });
    } catch (error) {
        console.error("Update Leave Status Error:", error);
        res.status(500).json({ message: "Failed to update leave status" });
    }
};
