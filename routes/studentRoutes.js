const express = require("express");
const router = express.Router();
// ✅ FIXED: Added curly braces { protect }
const { protect } = require("../middleware/authMiddleware");

// Import Controller Functions
const { 
    addStudent, 
    getStudents, 
    markAttendance, 
    deleteStudent 
} = require("../controllers/studentController");

// --- ROUTES ---
router.post("/", protect, addStudent);
router.get("/", protect, getStudents);
router.post("/attendance", protect, markAttendance); 
router.delete("/:id", protect, deleteStudent);

module.exports = router;