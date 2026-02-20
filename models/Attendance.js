const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // 1. Date (Kab ki attendance hai)
  date: {
    type: Date,
    required: true
  },
  
  // 2. Class ID (Kis class ki attendance hai)
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },

  // 3. Records (Baccho ki list aur unka status)
  records: [
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
      },
      status: {
        type: String,
        enum: ['Present', 'Absent', 'Late'], // Sirf ye 3 values allow hongi
        default: 'Present'
      }
    }
  ]
}, { timestamps: true });

// Optional: Ek class ki ek din mein do baar attendance na lag sake
attendanceSchema.index({ date: 1, classId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);