const express = require("express");
const router = express.Router();
const { addStudent, getStudents, markAttendance, deleteStudent } = require("../controllers/studentController");
const protect = require("../middleware/authMiddleware");

// Routes
router.post("/", protect, addStudent);
router.get("/", protect, getStudents);
router.post("/attendance", protect, markAttendance); 
router.delete("/:id", protect, deleteStudent);

module.exports = router;