const mongoose = require('mongoose');

const FeeStructureSchema = new mongoose.Schema({
    classId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true,
        unique: true 
    },
    academicYear: { type: String, default: "2026-27" },
    monthlyTuition: { type: Number, required: true },
    admissionFee: { type: Number, default: 0 },
    developmentFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    transportMonthly: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('FeeStructure', FeeStructureSchema);