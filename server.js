const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const path = require("path");

// --- CONFIGURATION ---
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ✅ Secure CORS origin handler (supports local dev ports + exact school production domains)
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Allow mobile apps, curl, server-to-server
  // Allow localhost & 127.0.0.1 on any port for local development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  // Allow verified production frontend domains
  if (
    /^https:\/\/radhey-shyam-shakuntala-seth.*\.vercel\.app$/.test(origin) ||
    (origin.endsWith(".vercel.app") && origin.includes("radhey-shyam")) ||
    (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)
  ) {
    return true;
  }
  return false;
};

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Socket origin not allowed."));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Share 'io' with routes/controllers
app.set("socketio", io);

// --- TRUST PROXY & HTTPS ENFORCEMENT ---
app.set("trust proxy", 1);

// Automatically redirect insecure HTTP requests to HTTPS in production
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// --- SECURITY MIDDLEWARE ---
// 1. HTTP Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Strict CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: HTTP origin not allowed."));
    }
  },
  credentials: true
}));

// 3. Rate Limiters (Defense against brute force & DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again after 15 minutes." }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/teachers/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// 4. Safe body size limits (prevents payload-based memory exhaustion)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// --- IMPORT ROUTES ---
const authRoutes = require('./routes/authRoutes');
const feeRoutes = require('./routes/feeRoutes');
const feeStructureRoutes = require('./routes/feeStructureRoutes');
const transportRoutes = require('./routes/transportRoutes');
const classRoutes = require("./routes/classRoutes");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const adminRoutes = require("./routes/adminRoutes");
const subjectRoutes = require('./routes/subjectRoutes');
const attendanceRoutes = require('./routes/attendance');
const salaryRoutes = require('./routes/salaryRoutes');
const markRoutes = require('./routes/markRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const digilockerRoutes = require('./routes/digilockerRoutes');

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fee-structure', feeStructureRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/expenses', expenseRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/digilocker', digilockerRoutes);

// Static Folder for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- BASE & HEALTH CHECK ROUTES ---
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "School Management System API is Running...",
    timestamp: new Date()
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    dbState: require("mongoose").connection.readyState === 1 ? "connected" : "connecting/disconnected"
  });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("🔥 Global Error Caught:", err.stack || err.message || err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

// --- SOCKET CONNECTION LOGIC ---
io.on("connection", (socket) => {
  socket.on("join_reset_room", (email) => {
    socket.join(email);
    console.log(`User waiting for mobile click in room: ${email}`);
  });

  socket.on("disconnect", () => {
    // disconnected
  });
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with Socket.io`);

  // --- KEEP-ALIVE AUTO-PING (For free-tier hosts like Render) ---
  const SERVER_URL = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;
  if (SERVER_URL) {
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
      const pingUrl = `${SERVER_URL}/api/health`;
      const client = pingUrl.startsWith("https") ? https : http;
      client.get(pingUrl, (res) => {
        console.log(`[Keep-Alive] Pinged ${pingUrl} (Status: ${res.statusCode})`);
      }).on("error", (err) => {
        console.error(`[Keep-Alive] Ping error: ${err.message}`);
      });
    }, PING_INTERVAL_MS);
    console.log(`[Keep-Alive] Configured to ping ${SERVER_URL} every 10 minutes`);
  }
});