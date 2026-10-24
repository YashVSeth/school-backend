const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  // 1. Grade (e.g. "10", "5", "LKG")
  grade: { type: String, required: true },
  
  // 2. Section (e.g. "A", "B", or optional/empty)
  section: { type: String, default: "" },

  // 3. Class Teacher (Main Monitor)
  classTeacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher', 
    default: null 
  },

  // ✅ 4. SUBJECTS LIST (UPDATED)
  // Ab hum seedha 'Subject' Model ki ID store karenge
  subjects: [
    {
      subject: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Subject', // Ye 'Subject' table se link hoga
          required: true 
      },
      teacher: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Teacher', // Ye 'Teacher' table se link hoga
          default: null 
      }
    }
  ],

  // 5. Fees
  feeStructure: {
    monthlyFee: { type: Number, default: 0 },
    yearlyFee: { type: Number, default: 0 }
  }
}, { timestamps: true });

// 🔒 Unique Constraint
classSchema.index({ grade: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);