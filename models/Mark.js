const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    examType: {
        type: String,
        required: true,
        enum: ['Unit Test', 'Mid Term', 'Final Exam', 'Assignment', 'Practical'],
        default: 'Unit Test'
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    maxScore: {
        type: Number,
        default: 100
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    remarks: {
        type: String,
        trim: true
    }
}, { timestamps: true });

// Ensure a student only has one score per subject per exam type
markSchema.index({ student: 1, subject: 1, examType: 1 }, { unique: true });

module.exports = mongoose.model('Mark', markSchema);
