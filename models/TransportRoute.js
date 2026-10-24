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
    },
    zone: {
        type: String,
        enum: ['Zone 1 (0-3 km)', 'Zone 2 (3-7 km)', 'Zone 3 (7-12 km)', 'Zone 4 (12+ km)'],
        default: 'Zone 1 (0-3 km)'
    },
    distanceKm: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

TransportRouteSchema.index({ zone: 1 });

module.exports = mongoose.model('TransportRoute', TransportRouteSchema);
