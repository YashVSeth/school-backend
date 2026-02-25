const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        required: true
    },
    timeSlot: {
        type: String,
        required: true // e.g., "9:00 AM"
    },
    subject: { type: String, required: true },

    // Optional ID for when a regular teacher is absent
    substituteTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        default: null
    },

    color: { type: String, default: '#4285F4' } // e.g., bg-blue-500 equivalent
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);