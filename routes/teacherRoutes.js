const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getMySchedule } = require('../controllers/teacherController');

// ----------------------------------------------------------------
// 1. CONFIGURE CLOUDINARY FILE STORAGE (✅ Best for Render/Vercel)
// ----------------------------------------------------------------
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'school_management_teachers',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']
    }
});

const upload = multer({ storage: storage });

// ----------------------------------------------------------------
// 2. POST: ADD TEACHER 
// ----------------------------------------------------------------
router.post('/', protect, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { email, password, ...restBody } = req.body;

        if (!email || !password || !restBody.fullName) {
            return res.status(400).json({ message: "Validation Failed: Email, Password, and Full Name are required." });
        }

        // A. Check Duplicate Email
        const existing = await Teacher.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Teacher with this email already exists" });
        }

        // B. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // C. Prepare Data
        const teacherData = {
            ...restBody,
            email,
            password: hashedPassword
        };

        // ✅ FIXED: Using Optional Chaining to prevent crashes if a file is missing
        if (req.files?.photo) {
            teacherData.photo = req.files.photo[0].path;
        }
        if (req.files?.resume) {
            teacherData.resume = req.files.resume[0].path;
        }
        if (req.files?.idProof) {
            teacherData.idProof = req.files.idProof[0].path;
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
// 3. GET: LIST TEACHERS 
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
// 3.5 GET: MY PROFILE (LOGGED-IN TEACHER)
// ----------------------------------------------------------------
router.get('/my-profile', protect, async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.user.id).select('-password');
        if (!teacher) return res.status(404).json({ message: "Teacher Profile not found" });
        res.json(teacher);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ----------------------------------------------------------------
// 3.6 GET: MY SCHEDULE (For logged-in Teacher)
// ----------------------------------------------------------------
router.get('/my-schedule', protect, getMySchedule);

// ----------------------------------------------------------------
// 4.5 PUT: BULK UPDATE TEACHER BASE SALARIES
// ----------------------------------------------------------------
router.put('/bulk-salary', protect, async (req, res) => {
    try {
        const { salaries } = req.body;
        // salaries array format: [{ teacherId: "...", baseSalary: 30000 }, ...]

        if (!Array.isArray(salaries) || salaries.length === 0) {
            return res.status(400).json({ message: "Valid salaries array is required" });
        }

        const bulkOps = salaries.map(record => ({
            updateOne: {
                filter: { _id: record.teacherId },
                update: { $set: { baseSalary: record.baseSalary } }
            }
        }));

        await Teacher.bulkWrite(bulkOps);

        res.json({ message: "Base salaries updated successfully!" });
    } catch (err) {
        console.error("PUT /bulk-salary ERROR:", err.message);
        res.status(500).json({ message: "Failed to update bulk salaries" });
    }
});

// ----------------------------------------------------------------
// 4. PUT: UPDATE TEACHER 
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

        // ✅ FIXED: Using Optional Chaining
        if (req.files?.photo) updates.photo = req.files.photo[0].path;
        if (req.files?.resume) updates.resume = req.files.resume[0].path;
        if (req.files?.idProof) updates.idProof = req.files.idProof[0].path;

        const updatedTeacher = await Teacher.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedTeacher) return res.status(404).json({ message: "Teacher not found" });

        res.json(updatedTeacher);
    } catch (err) {
        res.status(500).json({ message: "Error updating teacher" });
    }
});



// ----------------------------------------------------------------
// 5. DELETE: REMOVE TEACHER 
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
// 6. POST: TEACHER LOGIN
// ----------------------------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log("👉 Login Attempt via Email:", email);

        const teacher = await Teacher.findOne({ email: email });

        if (!teacher) {
            return res.status(404).json({ message: "Invalid Email" });
        }

        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid Password" });
        }

        const token = jwt.sign(
            { id: teacher._id, role: 'teacher' },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            teacherId: teacher._id,
            name: teacher.fullName,
            email: teacher.email,
            photo: teacher.photo,
            role: 'teacher'
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Login Failed" });
    }
});

module.exports = router;