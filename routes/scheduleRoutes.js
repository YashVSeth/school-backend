const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Specific explicit routes first
router.get('/teacher/:teacherId', protect, scheduleController.getScheduleByTeacher);

// Dynamic parameter routes
router.get('/:classId', protect, scheduleController.getScheduleByClass);
router.post('/', protect, adminOnly, scheduleController.addScheduleEntry);
router.put('/:id', protect, adminOnly, scheduleController.updateScheduleEntry);
router.delete('/:id', protect, adminOnly, scheduleController.deleteScheduleEntry);

module.exports = router;