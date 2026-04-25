const mongoose = require('mongoose');

const TransportRouteSchema = new mongoose.Schema({
    placeName: {
        type: String,
        required: [true, 'Please provide a place name'],
        trim: true,
        unique: true
    },
    fare: {
        type: Number,
        required: [true, 'Please provide a fare amount'],
        min: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('TransportRoute', TransportRouteSchema);
