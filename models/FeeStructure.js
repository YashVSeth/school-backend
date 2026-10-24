const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    desc: { type: String, default: '' },
    frequency: {
        type: String,
        uppercase: true,
        trim: true,
        enum: ['MONTHLY', 'QUARTERLY', 'HALF-YEARLY', 'YEARLY', 'ONE-TIME'],
        required: true,
        default: 'MONTHLY'
    },
    amount: { type: Number, required: true, min: 0 }
});

const feeStructureSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    academicYear: {
        type: String,
        required: true,
        default: '2026-27',
        trim: true
    },
    mandatoryFees: [feeItemSchema],
    optionalFees: [feeItemSchema],
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure one fee structure per class per academic year & fast query by year
feeStructureSchema.index({ classId: 1, academicYear: 1 }, { unique: true });
feeStructureSchema.index({ academicYear: 1 });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);