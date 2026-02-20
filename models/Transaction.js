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
        type: [String], // e.g., ["April Tuition", "Admission Fee"]
        default: []
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online', 'Cheque'],
        default: 'Cash'
    },
    date: {
        type: Date,
        default: Date.now
    },
    academicYear: {
        type: String,
        default: '2026-27'
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);