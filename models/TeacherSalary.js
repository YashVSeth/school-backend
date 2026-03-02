const mongoose = require('mongoose');

const teacherSalarySchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    amountPaid: {
        type: Number,
        required: true
    },
    paymentType: {
        type: String,
        enum: ['Full Salary', 'Partial Advance', 'Leave Deduction', 'Bonus'],
        required: true
    },
    month: {
        type: String, // Stored as YYYY-MM
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    remarks: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('TeacherSalary', teacherSalarySchema);
