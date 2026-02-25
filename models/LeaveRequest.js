const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    days: {
        type: Number,
        required: true,
        default: 1
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Declined'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
