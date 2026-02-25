const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    date: {
        type: String, // Stored as YYYY-MM-DD
        required: true
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late'],
        default: 'Present'
    }
}, { timestamps: true });

// A teacher can only have ONE attendance record per day. 
// If it changes, we update the existing one.
teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);
