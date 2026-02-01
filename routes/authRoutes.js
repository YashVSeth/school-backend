const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");

// Debugging: Check if functions are loaded correctly
if (!registerUser || !loginUser) {
  console.error("❌ ERROR: Auth Controller functions are missing!");
  console.error("registerUser:", registerUser);
  console.error("loginUser:", loginUser);
}

router.post("/register", registerUser);
router.post("/login", loginUser);

module.exports = router;