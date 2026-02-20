const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/authMiddleware'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

// ----------------------------------------------------------------
// 1. CONFIGURE FILE STORAGE
// ----------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// ----------------------------------------------------------------
// 2. POST: ADD TEACHER (✅ UPDATED: Username logic removed)
// ----------------------------------------------------------------
router.post('/', protect, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { email, password, ...restBody } = req.body;

        // A. Check Duplicate Email
        const existing = await Teacher.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Teacher with this email already exists" });
        }

        // B. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // C. Prepare Data (Ab hum 'username' nahi bhej rahe)
        const teacherData = { 
            ...restBody,
            email,
            password: hashedPassword 
        };

        if (req.files['photo']) {
            teacherData.photo = req.files['photo'][0].path; 
        }
        if (req.files['resume']) {
            teacherData.resume = req.files['resume'][0].path;
        }
        if (req.files['idProof']) {
            teacherData.idProof = req.files['idProof'][0].path;
        }

        const newTeacher = new Teacher(teacherData);
        const savedTeacher = await newTeacher.save();
        
        res.status(201).json(savedTeacher);

    } catch (err) {
        console.error("Backend Error:", err.message);
        res.status(400).json({ message: "Validation Failed", details: err.errors });
    }
});

// ----------------------------------------------------------------
// 3. GET: LIST TEACHERS (Sahi hai)
// ----------------------------------------------------------------
router.get('/', protect, async (req, res) => {
    try {
        const teachers = await Teacher.find().sort({ createdAt: -1 });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ----------------------------------------------------------------
// 4. PUT: UPDATE TEACHER (Sahi hai)
// ----------------------------------------------------------------
router.put('/:id', protect, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        if (updates.password && updates.password.length > 0) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        } else {
            delete updates.password; 
        }

        if (req.files['photo']) updates.photo = req.files['photo'][0].path;
        if (req.files['resume']) updates.resume = req.files['resume'][0].path;
        if (req.files['idProof']) updates.idProof = req.files['idProof'][0].path;

        const updatedTeacher = await Teacher.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedTeacher) return res.status(404).json({ message: "Teacher not found" });

        res.json(updatedTeacher);
    } catch (err) {
        res.status(500).json({ message: "Error updating teacher" });
    }
});

// ----------------------------------------------------------------
// 5. DELETE: REMOVE TEACHER (Sahi hai)
// ----------------------------------------------------------------
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTeacher = await Teacher.findByIdAndDelete(id);
        if (!deletedTeacher) return res.status(404).json({ message: "Teacher not found" });
        res.json({ message: "Teacher deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting teacher" });
    }
});

// ----------------------------------------------------------------
// 6. POST: TEACHER LOGIN (✅ UPDATED: LOGIN VIA EMAIL)
// ----------------------------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body; 

        console.log("👉 Login Attempt via Email:", email);

        // ✅ CHANGE: Ab 'email' se hi search ho raha hai
        const teacher = await Teacher.findOne({ email: email });

        if (!teacher) {
            return res.status(404).json({ message: "Invalid Email" });
        }

        // B. Password Check
        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid Password" });
        }

        // C. Token Generate
        const token = jwt.sign(
            { id: teacher._id, role: 'teacher' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' }
        );

        // D. Response
        res.json({
            token,
            teacherId: teacher._id,
            name: teacher.fullName,
            email: teacher.email, // ✅ Ab Email jayega
            photo: teacher.photo,
            role: 'teacher'
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Login Failed" });
    }
});

module.exports = router;