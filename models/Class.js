const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  section: { type: String, required: true },
  // NEW: Array to store subjects and the teacher assigned to them
  subjects: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // Link to Subject
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null } // Link to Teacher
  }]
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);