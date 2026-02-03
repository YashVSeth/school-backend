const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  feeType: {
    type: String, // e.g., "Tuition", "Transport", "Exam"
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Overdue'],
    default: 'Paid'
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String, // "Cash", "Online", "Cheque"
    default: "Cash"
  }
}, { timestamps: true });

module.exports = mongoose.model('Fee', feeSchema);