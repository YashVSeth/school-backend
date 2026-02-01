const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const auth = require('../middleware/authMiddleware');
const multer = require('multer'); // Import Multer
const path = require('path');

// ----------------------------------------------------------------
// 1. CONFIGURE FILE STORAGE
// ----------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Files will be saved in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    // Save as: timestamp-filename.extension (e.g., 16400000-photo.jpg)
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Initialize Upload Middleware
const upload = multer({ storage: storage });

// ----------------------------------------------------------------
// 2. UPDATED POST ROUTE (Now accepts Files + Text)
// ----------------------------------------------------------------
// We use upload.fields to accept specific file inputs: 'photo' and 'resume'
router.post('/', auth, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        // When using Multer:
        // - Text data is in req.body
        // - Files are in req.files
        
        console.log("Body Received:", req.body);
        console.log("Files Received:", req.files);

        // Create the data object to save
        const teacherData = { ...req.body };

        // Add file paths to the data if files were uploaded
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
        res.status(400).json({ 
            message: "Validation Failed", 
            details: err.errors 
        });
    }
});

// @route   GET /api/teachers
router.get('/', auth, async (req, res) => {
    try {
        const teachers = await Teacher.find().sort({ createdAt: -1 });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;