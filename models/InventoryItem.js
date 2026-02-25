const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['InStock', 'Low', 'Out'],
        default: 'InStock'
    },
    message: {
        type: String, // E.g., "Chemical reagents below safety threshold"
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
