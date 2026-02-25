const LeaveRequest = require('../models/LeaveRequest');
const InventoryItem = require('../models/InventoryItem');
const Fee = require('../models/Fee');
const Schedule = require('../models/Schedule');

exports.getDashboardWidgets = async (req, res) => {
    try {
        // Fetch all pending actions concurrently to make the dashboard fast
        const [leaves, lowInventory, recentSubstitutions] = await Promise.all([
            LeaveRequest.find({ status: 'Pending' }).populate('teacher', 'firstName lastName fullName'),
            InventoryItem.find({ status: 'Low' }),
            Schedule.find({ substituteTeacher: { $ne: null } })
                .populate('substituteTeacher', 'firstName lastName fullName')
                .populate('classId', 'grade')
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
            pendingActions.push({
                type: 'LEAVE',
                id: l._id,
                title: `${name} (Teacher)`,
                subtitle: `${l.reason} • ${l.days} Day(s)`,
                iconText: name.substring(0, 2).toUpperCase(), // e.g. "RK"
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

        lowInventory.forEach(i => {
            pendingActions.push({
                type: 'INVENTORY',
                id: i._id,
                title: i.itemName,
                subtitle: i.message,
                icon: 'alert'
            });
        });

        // Format Substitutions for the live board
        const formattedSubstitutions = recentSubstitutions.map(sub => {
            const subName = sub.substituteTeacher?.fullName || `${sub.substituteTeacher?.firstName || ''} ${sub.substituteTeacher?.lastName || ''}`.trim();
            const gradeName = sub.classId?.grade || 'Unknown Class';

            return {
                id: sub._id,
                period: sub.timeSlot,
                className: `Class ${gradeName}`,
                subject: sub.subject,
                substituteName: subName || 'Unknown Sub'
            };
        });

        res.json({
            pendingActions,
            substitutions: formattedSubstitutions
        });

    } catch (error) {
        console.error("Dashboard Widget Error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard widgets data." });
    }
};
