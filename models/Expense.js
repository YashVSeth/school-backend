const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity or Unit is required'],
        min: [0, 'Quantity cannot be negative'],
    },
    unitPrice: {
        type: Number,
        required: [true, 'Unit Price is required'],
        min: [0, 'Unit Price cannot be negative'],
    },
    total: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: [0, 'Total cannot be negative'],
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        default: Date.now
    }
}, { timestamps: true });

// Pre-save hook to ensure the total is strictly quantity * unitPrice
expenseSchema.pre('save', function (next) {
    if (this.isModified('quantity') || this.isModified('unitPrice')) {
        this.total = parseFloat((this.quantity * this.unitPrice).toFixed(2));
    }
    next();
});

module.exports = mongoose.model('Expense', expenseSchema);
