const express = require('express');
const router = express.Router();

// ✅ 1. Import Middleware (Fixed: Added curly braces)
const { protect } = require('../middleware/authMiddleware');

// 2. Import Controller
// ensuring these names match exactly what is in teacherAttendanceController.js
const {
  getTeacherMonthlyAttendance,
  markTeacherAttendance,
  getDailyAttendance,
  bulkSaveAttendance
} = require('../controllers/teacherAttendanceController');

// --- DEBUGGING: Check if imports loaded correctly ---
if (!protect) {
    console.error("❌ ERROR: 'protect' middleware is missing. Check authMiddleware.js export.");
}
if (!getTeacherMonthlyAttendance) {
    console.error("❌ ERROR: Controller functions are missing. Check teacherAttendanceController.js exports.");
}

// 3. Define Routes
// Route to get monthly attendance for a specific teacher
router.get('/teacher/:teacherId', protect, getTeacherMonthlyAttendance);

// Route to mark single attendance (if needed)
router.post('/teacher', protect, markTeacherAttendance);

// Route to get daily attendance for all teachers (for the grid view)
router.get('/daily', protect, getDailyAttendance); 
// Note: Changed '/teachers/daily' to '/daily' to match standard REST practices, 
// but if your frontend calls '/api/attendance/teachers/daily', keep it as is.

// Route to save bulk attendance
router.post('/bulk', protect, bulkSaveAttendance);

module.exports = router;