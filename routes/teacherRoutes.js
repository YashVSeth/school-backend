const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getMySchedule } = require('../controllers/teacherController');
const { uploadToGoogleDrive } = require('../config/googleDrive');

// ----------------------------------------------------------------
// 1. CONFIGURE STORAGE & HELPERS
// ----------------------------------------------------------------
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Helper to upload buffer to Cloudinary with fallback
const uploadToCloudinary = (file, folder = 'school_management_teachers') => {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return resolve(null);
        }
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folder, resource_type: 'auto' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url || result.url);
            }
        );
        uploadStream.end(file.buffer);
    });
};

// Helper to upload file prioritizing Google Drive for documents/resumes
const uploadFile = async (file, prefix = 'doc', forceGoogleDrive = false) => {
    if (!file) return null;

    if (forceGoogleDrive) {
        try {
            const driveRes = await uploadToGoogleDrive(
                file.buffer,
                `${prefix}_${file.originalname}`,
                file.mimetype
            );
            return driveRes.webViewLink || driveRes.url;
        } catch (driveErr) {
            console.warn(`⚠️ Google Drive upload notice (${prefix}):`, driveErr.message);
            // Fallback to Cloudinary if Google Drive is not configured
            try {
                return await uploadToCloudinary(file);
            } catch (cErr) {
                console.warn('⚠️ Cloudinary fallback notice:', cErr.message);
                return null;
            }
        }
    } else {
        // Try Cloudinary first for images, fallback to Drive
        try {
            const cUrl = await uploadToCloudinary(file);
            if (cUrl) return cUrl;
        } catch (cErr) {
            console.warn('⚠️ Cloudinary notice:', cErr.message);
        }

        try {
            const driveRes = await uploadToGoogleDrive(
                file.buffer,
                `${prefix}_${file.originalname}`,
                file.mimetype
            );
            return driveRes.url;
        } catch (driveErr) {
            console.warn('⚠️ Google Drive notice:', driveErr.message);
            return null;
        }
    }
};

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

        // Upload files (Resume to Google Drive, Photos/ID to Cloudinary/Drive)
        if (req.files?.photo) {
            teacherData.photo = await uploadFile(req.files.photo[0], 'teacher_photo', false);
        }
        if (req.files?.resume) {
            // Google Drive is used for resumes
            teacherData.resume = await uploadFile(req.files.resume[0], 'teacher_resume', true);
        }
        if (req.files?.idProof) {
            teacherData.idProof = await uploadFile(req.files.idProof[0], 'teacher_idproof', false);
        }

        const newTeacher = new Teacher(teacherData);
        const savedTeacher = await newTeacher.save();

        res.status(201).json(savedTeacher);

    } catch (err) {
        console.error("Backend Error:", err);
        
        if (err.code === 11000) {
            const duplicateField = Object.keys(err.keyValue)[0];
            return res.status(400).json({ 
                message: `Duplicate Error: A teacher with this ${duplicateField} already exists.` 
            });
        }

        res.status(400).json({ message: err.message || "Validation Failed", details: err.errors });
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

        if (req.files?.photo) {
            updates.photo = await uploadFile(req.files.photo[0], 'teacher_photo', false);
        }
        if (req.files?.resume) {
            // Google Drive is used for resumes
            updates.resume = await uploadFile(req.files.resume[0], 'teacher_resume', true);
        }
        if (req.files?.idProof) {
            updates.idProof = await uploadFile(req.files.idProof[0], 'teacher_idproof', false);
        }

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

// ----------------------------------------------------------------
// 7. POST: BULK IMPORT TEACHERS FROM EXCEL
// ----------------------------------------------------------------
router.post('/bulk-import', protect, async (req, res) => {
    try {
        const { teachers } = req.body;
        if (!Array.isArray(teachers) || teachers.length === 0) {
            return res.status(400).json({ success: false, message: "No teacher records provided for import." });
        }

        const importedTeachers = [];
        const errors = [];

        const salt = await bcrypt.genSalt(10);
        const defaultHashedPassword = await bcrypt.hash("Teacher@123", salt);

        for (let i = 0; i < teachers.length; i++) {
            const row = teachers[i];
            const fullName = String(row.fullName || row.name || `${row.firstName || ''} ${row.lastName || ''}`).trim();
            if (!fullName) {
                errors.push({ row: i + 1, error: "Missing teacher full name" });
                continue;
            }

            const email = String(row.email || `${fullName.toLowerCase().replace(/\s+/g, '')}${Math.floor(Math.random() * 1000)}@school.com`).trim();
            const phone = String(row.phone || row.mobile || row.contact || '').trim();

            const existingTeacher = await Teacher.findOne({ email });
            if (existingTeacher) {
                errors.push({ row: i + 1, name: fullName, error: `Email ${email} is already registered.` });
                continue;
            }

            let hashedPassword = defaultHashedPassword;
            if (row.password) {
                hashedPassword = await bcrypt.hash(String(row.password), salt);
            }

            const newTeacher = new Teacher({
                fullName,
                email,
                phone,
                password: hashedPassword,
                gender: row.gender || 'Male',
                qualification: row.qualification || '',
                experience: String(row.experience || ''),
                subjectSpecialization: row.subjectSpecialization || row.subject || '',
                salary: Number(row.salary) || 0,
                address: row.address || '',
                joiningDate: row.joiningDate ? new Date(row.joiningDate) : new Date(),
                role: 'teacher'
            });

            try {
                const saved = await newTeacher.save();
                importedTeachers.push(saved);
            } catch (saveErr) {
                errors.push({ row: i + 1, name: fullName, error: saveErr.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Successfully imported ${importedTeachers.length} teachers.`,
            importedCount: importedTeachers.length,
            totalRows: teachers.length,
            errors
        });
    } catch (error) {
        console.error("Bulk Import Teachers Error:", error);
        res.status(500).json({ success: false, message: error.message || "Bulk import failed." });
    }
});

module.exports = router;