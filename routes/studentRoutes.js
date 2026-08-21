const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");

// Memory storage for Google Drive upload stream
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Import Controller Functions
const { 
    addStudent, 
    getStudents, 
    markAttendance, 
    deleteStudent,
    updateStudent
} = require("../controllers/studentController");

// --- ROUTES ---
router.post("/", protect, upload.single('photo'), addStudent);
router.get("/", protect, getStudents);
router.post("/attendance", protect, markAttendance); 
router.delete("/:id", protect, deleteStudent);
router.put("/:id", protect, upload.single('photo'), updateStudent);

module.exports = router;