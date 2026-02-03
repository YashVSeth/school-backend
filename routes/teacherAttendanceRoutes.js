const express = require('express');
const router = express.Router();

// 1. Import Middleware (Check path!)
const protect  = require('../middleware/authMiddleware');

// 2. Import Controller
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
// We add 'protect' as the second argument. If 'protect' is undefined, this line crashes.
router.get('/teacher/:teacherId', protect, getTeacherMonthlyAttendance);
router.post('/teacher', protect, markTeacherAttendance);
router.get('/teachers/daily', protect, getDailyAttendance);
router.post('/teachers/bulk', protect, bulkSaveAttendance);

module.exports = router;