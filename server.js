const express = require("express");

const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// 1. Load Config
dotenv.config();

// 2. Connect to Database
connectDB();

const app = express();

// 3. Middleware
app.use(cors());
app.use(express.json()); // Allows backend to understand JSON

// 4. Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/classes", require("./routes/classRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
// 5. Test Route
app.get("/", (req, res) => {
  res.send("School Management System API is Running...");
});

// 6. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});