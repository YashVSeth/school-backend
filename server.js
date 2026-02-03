const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Load Config
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// --- IMPORT ROUTES ---
const authRoutes = require('./routes/authRoutes');
const feeRoutes = require('./routes/feeRoutes');
const teacherAttendanceRoutes = require('./routes/teacherAttendanceRoutes');

// --- MOUNT ROUTES ---
// ✅ Auth Routes (Only defined ONCE now)
app.use('/api/auth', authRoutes);

app.use('/api/fees', feeRoutes);
app.use('/api/attendance', teacherAttendanceRoutes);

app.use("/api/classes", require("./routes/classRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use('/api/subjects', require('./routes/subjectRoutes'));

// Public Uploads
app.use('/uploads', express.static('uploads'));

// Test Route
app.get("/", (req, res) => {
  res.send("School Management System API is Running...");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});