const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    desc: { type: String, default: '' },
    frequency: {
        type: String,
        enum: ['MONTHLY', 'QUARTERLY', 'HALF-YEARLY', 'YEARLY', 'ONE-TIME'],
        required: true
    },
    amount: { type: Number, required: true }
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
        default: '2026-27'
    },
    mandatoryFees: [feeItemSchema],
    optionalFees: [feeItemSchema],
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure one fee structure per class per academic year
feeStructureSchema.index({ classId: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);