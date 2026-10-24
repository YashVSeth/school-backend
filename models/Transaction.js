const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    receiptNo: {
        type: String,
        trim: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    monthsPaid: {
        type: [String], // e.g., ["April Tuition", "Admission Fee"]
        default: []
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online', 'Cheque', 'UPI', 'Card', 'Bank Transfer'],
        default: 'Cash'
    },
    date: {
        type: Date,
        default: Date.now,
        index: true
    },
    academicYear: {
        type: String,
        default: '2026-27',
        index: true
    },
    invoices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
    }],
    remarks: {
        type: String,
        default: ''
    }
}, { timestamps: true });

transactionSchema.index({ academicYear: 1, date: -1 });
transactionSchema.index({ student: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);