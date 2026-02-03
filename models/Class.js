const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  section: { type: String, required: true },
  
  // ✅ ADD THIS NEW SECTION
  feeStructure: {
    monthlyFee: { type: Number, default: 0 },
    yearlyFee: { type: Number, default: 0 },
    description: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);