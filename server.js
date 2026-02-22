const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const path = require("path");

// --- CONFIGURATION ---
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ✅ Define allowed origins in one place so it's easy to manage
const allowedOrigins = [
  "http://localhost:5173",
  "https://radhey-shyam-shakuntala-seth-shikshan-sansthaan.vercel.app",
   // 👈 Added your new Vercel URL!
];

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Share 'io' with routes/controllers
app.set("socketio", io);

// --- MIDDLEWARE ---
// ✅ UPDATED: Express CORS now uses the exact same allowed list and allows credentials
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// --- IMPORT ROUTES (Moved to top for better debugging) ---
const authRoutes = require('./routes/authRoutes');
const feeRoutes = require('./routes/feeRoutes');
const feeStructureRoutes = require('./routes/feeStructureRoutes');

const classRoutes = require("./routes/classRoutes");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const adminRoutes = require("./routes/adminRoutes");
const subjectRoutes = require('./routes/subjectRoutes');
const attendanceRoutes = require('./routes/attendance');

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fee-structure', feeStructureRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/schedule', require('./routes/scheduleRoutes'));

// Static Folder for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- SOCKET CONNECTION LOGIC ---
io.on("connection", (socket) => {
  // Example: Laptop joins room to wait for mobile confirmation
  socket.on("join_reset_room", (email) => {
    socket.join(email);
    console.log(`User waiting for mobile click in room: ${email}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// --- BASE ROUTE ---
app.get("/", (req, res) => {
  res.send("School Management System API is Running...");
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Socket.io`);
});