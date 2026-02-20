const mongoose = require('mongoose');

// Schema for an individual fee row
const feeItemSchema = new mongoose.Schema({
    id: { type: String }, // To keep track of the frontend row ID
    name: { type: String, required: true },
    frequency: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly', 'One-time'], required: true },
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
    // The two arrays that match your frontend state!
    mandatoryFees: [feeItemSchema],
    optionalFees: [feeItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);