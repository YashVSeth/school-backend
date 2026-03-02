const LeaveRequest = require('../models/LeaveRequest');
const Fee = require('../models/Fee');
const Schedule = require('../models/Schedule');

exports.getDashboardWidgets = async (req, res) => {
    try {
        // Fetch all pending actions concurrently to make the dashboard fast
        // NOTE: Removing InventoryItem as it may not exist or cause issues.
        const [leaves] = await Promise.all([
            LeaveRequest.find({ status: 'Pending' }).populate('teacher', 'firstName lastName fullName')
        ]);

        // We can optionally mock fee anomalies here, or look for genuine pending invoices if they exist
        // For the sake of the widget, let's grab the 5 most recent outstanding Fee records.
        const pendingFees = await Fee.find({ status: 'Pending' })
            .populate('studentId', 'firstName lastName grade')
            .limit(5);

        // Format Pending Actions for the Frontend List
        const pendingActions = [];

        leaves.forEach(l => {
            const name = l.teacher?.fullName || `${l.teacher?.firstName || ''} ${l.teacher?.lastName || ''}`.trim() || 'Unknown Teacher';

            // Format dates simply
            const sDate = new Date(l.startDate).toLocaleDateString('en-GB');
            const eDate = new Date(l.endDate).toLocaleDateString('en-GB');

            pendingActions.push({
                type: 'LEAVE',
                id: l._id,
                title: `${name} (Teacher)`,
                subtitle: `${l.reason} • ${sDate} to ${eDate}`,
                iconText: name.substring(0, 2).toUpperCase(), // e.g. "RK"
                leaveData: l
            });
        });

        pendingFees.forEach(f => {
            const name = f.studentId?.firstName ? `${f.studentId.firstName} ${f.studentId.lastName || ''}` : 'Unknown Student';
            const grade = f.studentId?.grade || 'Unknown Class';
            pendingActions.push({
                type: 'FEE',
                id: f._id,
                title: `${name} (Class ${grade})`,
                subtitle: `${f.feeType} • ₹${f.amount} pending`,
                icon: 'wallet'
            });
        });

        // Removed Inventory logic

        res.json({
            pendingActions,
            substitutions: [] // Returning empty array to prevent frontend mapping crashes initially
        });

    } catch (error) {
        console.error("Dashboard Widget Error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard widgets data." });
    }
};
