const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');

const {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus
} = require('../controllers/leaveController');

// ----------------------------------------------------------------
// 1. TEACHER ROUTES
// ----------------------------------------------------------------

// Apply for a new leave
router.post('/apply', protect, applyLeave);

// Get my own leave history
router.get('/my-leaves', protect, getMyLeaves);

// ----------------------------------------------------------------
// 2. ADMIN ROUTES
// ----------------------------------------------------------------

// Get all leaves (optionally filter by ?status=Pending)
router.get('/', protect, adminOnly, getAllLeaves);

// Approve or Decline a leave request
router.put('/:id/status', protect, adminOnly, updateLeaveStatus);

module.exports = router;
