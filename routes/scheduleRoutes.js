const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/authMiddleware');
const protect = authMiddleware.protect || authMiddleware;

// Specific explicit routes first
router.get('/teacher/:teacherId', protect, scheduleController.getScheduleByTeacher);

// Dynamic parameter routes
router.get('/:classId', protect, scheduleController.getScheduleByClass);
router.post('/', protect, scheduleController.addScheduleEntry);
router.put('/:id', protect, scheduleController.updateScheduleEntry);
router.delete('/:id', protect, scheduleController.deleteScheduleEntry);

module.exports = router;