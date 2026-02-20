const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            console.log("🔹 Token Received:", token.substring(0, 10) + "..."); // Debugging
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("✅ Token Decoded ID:", decoded.id);
            
            // Attach user to request
            req.user = await User.findById(decoded.id).select("-password");
            
            if (!req.user) {
                return res.status(401).json({ message: "Not authorized, user not found" });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    } else {
        res.status(401).json({ message: "Not authorized, no token" });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === "admin") { // Adjust "role" based on your User model (e.g., isAdmin)
        next();
    } else {
        res.status(403).json({ message: "Not authorized as an admin" });
    }
};

// ✅ EXPORT AS AN OBJECT
module.exports = { protect, adminOnly };