// backend/seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

dotenv.config();

const createAdmin = async () => {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB...");

    // 2. Check if Admin already exists
    const existingAdmin = await User.findOne({ email: "admin@school.com" });
    if (existingAdmin) {
      console.log("Admin already exists!");
      process.exit();
    }

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    // 4. Create Admin
    const admin = new User({
      name: "Super Admin",
      email: "admin@school.com",
      password: hashedPassword,
      role: "admin",
    });

    await admin.save();
    console.log("✅ Admin Account Created Successfully!");
    console.log("📧 Email: admin@school.com");
    console.log("🔑 Password: admin123");

    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

createAdmin();