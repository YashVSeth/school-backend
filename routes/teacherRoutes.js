const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
// ✅ FIXED: Use curly braces to extract 'protect'
const { protect } = require('../middleware/authMiddleware'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 

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
// 2. POST: ADD TEACHER
// ----------------------------------------------------------------
// ✅ FIXED: Changed 'auth' to 'protect'
router.post('/', protect, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const teacherData = { ...req.body };

        if (req.files['photo']) {
            teacherData.photoUrl = req.files['photo'][0].path;
        }
        if (req.files['resume']) {
            teacherData.resumeUrl = req.files['resume'][0].path;
        }
        if (req.files['idProof']) {
            teacherData.idProofUrl = req.files['idProof'][0].path;
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
// ✅ FIXED: Changed 'auth' to 'protect'
router.get('/', protect, async (req, res) => {
    try {
        const teachers = await Teacher.find().sort({ createdAt: -1 });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ----------------------------------------------------------------
// 4. PUT: UPDATE TEACHER
// ----------------------------------------------------------------
// ✅ FIXED: Changed 'auth' to 'protect'
router.put('/:id', protect, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Use findByIdAndUpdate for a simpler update logic
        // We first need to process the files if they exist
        let updates = { ...req.body };

        if (req.files['photo']) {
            updates.photoUrl = req.files['photo'][0].path;
        }
        if (req.files['resume']) {
            updates.resumeUrl = req.files['resume'][0].path;
        }
        if (req.files['idProof']) {
            updates.idProofUrl = req.files['idProof'][0].path;
        }

        const updatedTeacher = await Teacher.findByIdAndUpdate(id, updates, { new: true });

        if (!updatedTeacher) {
            return res.status(404).json({ message: "Teacher not found" });
        }

        res.json(updatedTeacher);

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ message: "Error updating teacher" });
    }
});

// ----------------------------------------------------------------
// 5. DELETE: REMOVE TEACHER
// ----------------------------------------------------------------
// ✅ FIXED: Changed 'auth' to 'protect'
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTeacher = await Teacher.findByIdAndDelete(id);

        if (!deletedTeacher) {
            return res.status(404).json({ message: "Teacher not found" });
        }

        res.json({ message: "Teacher deleted successfully" });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ message: "Error deleting teacher" });
    }
});

module.exports = router;