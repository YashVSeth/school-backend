const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  amountPaid: { 
    type: Number, 
    default: 0,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['Unpaid', 'Partially Paid', 'Paid'], 
    default: 'Unpaid',
    index: true
  },
  dueDate: { 
    type: Date,
    default: Date.now,
    index: true
  },
  academicYear: {
    type: String,
    default: '2026-27',
    index: true
  }
}, { timestamps: true });

invoiceSchema.index({ student: 1, status: 1 });
invoiceSchema.index({ academicYear: 1, status: 1 });
invoiceSchema.index({ student: 1, title: 1, academicYear: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);