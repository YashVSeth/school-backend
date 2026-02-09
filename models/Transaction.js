const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  monthsPaid: {
    type: [String], // Array of strings like ["Apr", "May"]
    default: []
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Online', 'Cheque'],
    default: 'Cash'
  },
  academicYear: {
    type: String,
    default: '2026-27'
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);