const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http"); // Required for Socket.io
const { Server } = require("socket.io"); // Required for Socket.io

// Load Config
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app); // Create HTTP server

// ✅ Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173",
      "https://radhey-shyam-shakuntala-seth-shikshan-sansthaan.vercel.app"
     ], // Your Vite Frontend URL
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json()); 

// ✅ Share 'io' with our routes/controllers
app.set("socketio", io);

// Socket.io Connection Logic
io.on("connection", (socket) => {
  // When the laptop starts waiting, it joins a room based on email
  socket.on("join_reset_room", (email) => {
    socket.join(email);
    console.log(`User waiting for mobile click in room: ${email}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// --- ROUTES ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/attendance', require('./routes/teacherAttendanceRoutes'));
app.use("/api/classes", require("./routes/classRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use('/api/subjects', require('./routes/subjectRoutes'));

app.use('/uploads', express.static('uploads'));

app.get("/", (req, res) => {
  res.send("School Management System API is Running...");
});

// ✅ Use 'server.listen' instead of 'app.listen'
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Socket.io`);
});