const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Added to help delete old files if needed

// ----------------------------------------------------------------
// 1. CONFIGURE FILE STORAGE
// ----------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // timestamp-filename.extension
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// ----------------------------------------------------------------
// 2. POST: ADD TEACHER
// ----------------------------------------------------------------
router.post('/', auth, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        // Use spread operator to get text fields (fullName, email, etc.)
        const teacherData = { ...req.body };

        // Map the uploaded files to the database fields
        // Note: We save them as 'photoUrl' to match the Frontend code
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
router.get('/', auth, async (req, res) => {
    try {
        const teachers = await Teacher.find().sort({ createdAt: -1 });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ----------------------------------------------------------------
// 4. PUT: UPDATE TEACHER (Fixes "Edit Option Not Working")
// ----------------------------------------------------------------
router.put('/:id', auth, upload.fields([
  { name: 'photo', maxCount: 1 }, 
  { name: 'resume', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // Check if new files were uploaded and update paths accordingly
        if (req.files['photo']) {
            updates.photoUrl = req.files['photo'][0].path;
        }
        if (req.files['resume']) {
            updates.resumeUrl = req.files['resume'][0].path;
        }
        if (req.files['idProof']) {
            updates.idProofUrl = req.files['idProof'][0].path;
        }

        // Find by ID and Update
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
// 5. DELETE: REMOVE TEACHER (Adds "Delete Option")
// ----------------------------------------------------------------
router.delete('/:id', auth, async (req, res) => {
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