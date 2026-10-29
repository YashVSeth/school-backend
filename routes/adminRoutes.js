const express = require("express");
const router = express.Router();
const { getStats, getDataCounts, clearData } = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/stats", protect, adminOnly, getStats);
router.get("/data-counts", protect, adminOnly, getDataCounts);
router.post("/clear-data", protect, adminOnly, clearData);

module.exports = router;