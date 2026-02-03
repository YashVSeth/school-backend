const express = require('express');
const router = express.Router();

// ✅ Import the controller functions (ONLY ONCE)
const { 
    registerUser, 
    loginUser, 
    forgotPassword, 
    resetPassword,
    verifyLinkAndNotify 
} = require('../controllers/authController');

// Debugging check
if (!registerUser || !loginUser || !forgotPassword || !resetPassword) {
    console.error("❌ Error: One or more auth controller functions are undefined. Check your imports.");
}

// --- DEFINE ROUTES ---

// Register & Login
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/verify-link/:token', verifyLinkAndNotify);
// Password Reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);


module.exports = router;