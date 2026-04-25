const TransportRoute = require('../models/TransportRoute');

// @desc    Get all transport routes
// @route   GET /api/transport
// @access  Private
exports.getRoutes = async (req, res) => {
    try {
        const routes = await TransportRoute.find().sort({ placeName: 1 });
        res.status(200).json(routes);
    } catch (err) {
        console.error("Error fetching transport routes:", err);
        res.status(500).json({ message: "Server error fetching routes" });
    }
};

// @desc    Add a new transport route
// @route   POST /api/transport
// @access  Private (Admin only)
exports.addRoute = async (req, res) => {
    const { placeName, fare } = req.body;

    if (!placeName || fare === undefined) {
        return res.status(400).json({ message: "Place name and fare are required" });
    }

    try {
        const existingRoute = await TransportRoute.findOne({ placeName: { $regex: new RegExp(`^${placeName}$`, 'i') } });
        if (existingRoute) {
            return res.status(400).json({ message: "A route with this place name already exists" });
        }

        const route = await TransportRoute.create({ placeName, fare });
        res.status(201).json(route);
    } catch (err) {
        console.error("Error adding transport route:", err);
        if (err.code === 11000) {
             return res.status(400).json({ message: "A route with this place name already exists" });
        }
        res.status(500).json({ message: "Server error adding route" });
    }
};

// @desc    Delete a transport route
// @route   DELETE /api/transport/:id
// @access  Private (Admin only)
exports.deleteRoute = async (req, res) => {
    try {
        const route = await TransportRoute.findByIdAndDelete(req.params.id);
        if (!route) {
            return res.status(404).json({ message: "Route not found" });
        }
        res.status(200).json({ message: "Route deleted successfully" });
    } catch (err) {
        console.error("Error deleting transport route:", err);
        res.status(500).json({ message: "Server error deleting route" });
    }
};
