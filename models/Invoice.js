const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  amountPaid: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['Unpaid', 'Partially Paid', 'Paid'], 
    default: 'Unpaid' 
  },
  dueDate: { 
    type: Date,
    default: Date.now
  },
  academicYear: {
    type: String,
    default: '2026-27'
  }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);