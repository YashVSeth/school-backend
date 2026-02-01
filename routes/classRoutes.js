const express = require("express");
const router = express.Router();

// Import Controller and Middleware
const { addClass, getClasses } = require("../controllers/classController");
const protect = require("../middleware/authMiddleware");

// Debugging: If these log as "undefined", we know which file is broken
if (!addClass) console.error("❌ ERROR: addClass is missing!");
if (!protect) console.error("❌ ERROR: protect middleware is missing!");

// Routes
router.post("/", protect, addClass);
router.get("/", protect, getClasses);

module.exports = router;