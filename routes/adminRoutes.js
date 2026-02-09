const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/adminController");

// ✅ FIXED: Added curly braces to extract the function
const { protect } = require("../middleware/authMiddleware");

router.get("/stats", protect, getStats);

module.exports = router;