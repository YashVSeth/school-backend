const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getMySchedule } = require('../controllers/teacherController');
const { uploadToGoogleDrive } = require('../config/googleDrive');

// ----------------------------------------------------------------
// 1. CONFIGURE STORAGE & HELPERS
// ----------------------------------------------------------------
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Helper to upload file to Google Drive (with Base64 fallback for images)
const uploadFile = async (file, prefix = 'doc') => {
    if (!file) return null;

    try {
        const teacherFolderId = process.env.GOOGLE_DRIVE_TEACHER_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const driveRes = await uploadToGoogleDrive(
            file.buffer,
            `${prefix}_${file.originalname}`,
            file.mimetype,
            teacherFolderId
        );
        return driveRes.url || driveRes.webViewLink;
    } catch (driveErr) {
        console.warn(`⚠️ Google Drive upload notice (${prefix}):`, driveErr.message);
        // If image, fallback to Base64 data URI
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        }
        return null;
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

// Helper for text normalization
const normalizeText = (text) => {
    return String(text || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
};

const isDummyPhone = (phone) => {
    const p = String(phone || '').replace(/\D/g, '');
    return !p || /^0+$/.test(p) || p.length < 10;
};

// ----------------------------------------------------------------
// 7. POST: BULK IMPORT TEACHERS FROM EXCEL
// ----------------------------------------------------------------
router.post('/bulk-import', protect, async (req, res) => {
    try {
        const { teachers } = req.body;
        if (!Array.isArray(teachers) || teachers.length === 0) {
            return res.status(400).json({ success: false, message: "No teacher records provided for import." });
        }

        // Pre-fetch existing teachers to detect duplicates quickly
        const existingTeachers = await Teacher.find({}, 'fullName email phone aadhaarNumber');
        const existingEmailSet = new Set();
        const existingPhoneSet = new Set();
        const existingAadhaarSet = new Set();
        const existingNamePhoneSet = new Set();

        existingTeachers.forEach(t => {
            if (t.email) existingEmailSet.add(t.email.toLowerCase().trim());
            if (t.phone && !isDummyPhone(t.phone)) existingPhoneSet.add(t.phone.trim());
            if (t.aadhaarNumber) existingAadhaarSet.add(t.aadhaarNumber.trim());
            if (t.fullName && t.phone && !isDummyPhone(t.phone)) {
                existingNamePhoneSet.add(`${normalizeText(t.fullName)}|${t.phone.trim()}`);
            }
        });

        const inBatchEmails = new Set();
        const inBatchPhones = new Set();
        const inBatchAadhaars = new Set();
        const inBatchNamePhone = new Set();

        const importedTeachers = [];
        const rejected = [];
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

            const phone = String(row.phone || row.mobile || row.contact || '').trim();
            const aadhaarNumber = String(row.aadhaarNumber || row.aadharNo || row.aadhar || '').trim();

            let rawEmail = String(row.email || '').trim().toLowerCase();
            let email = rawEmail;
            if (!email) {
                const cleanName = normalizeText(fullName) || 'teacher';
                email = `${cleanName}${i + 1}@school.com`;
            }

            // ─── DUPLICATE / REJECTION CHECK ───
            const normName = normalizeText(fullName);
            const namePhoneKey = `${normName}|${phone}`;

            let rejectReason = null;
            if (rawEmail && existingEmailSet.has(rawEmail)) {
                rejectReason = `Email (${rawEmail}) is already registered to an existing teacher.`;
            } else if (rawEmail && inBatchEmails.has(rawEmail)) {
                rejectReason = `Duplicate Email (${rawEmail}) appears multiple times in this uploaded file.`;
            } else if (aadhaarNumber && (existingAadhaarSet.has(aadhaarNumber) || inBatchAadhaars.has(aadhaarNumber))) {
                rejectReason = `Aadhaar Number (${aadhaarNumber}) is already registered to an existing teacher.`;
            } else if (!isDummyPhone(phone) && existingNamePhoneSet.has(namePhoneKey)) {
                rejectReason = `Teacher with same name and phone (${phone}) is already registered.`;
            } else if (!isDummyPhone(phone) && inBatchNamePhone.has(namePhoneKey)) {
                rejectReason = `Duplicate: Teacher appears multiple times in this uploaded file.`;
            }

            if (rejectReason) {
                rejected.push({
                    row: i + 1,
                    name: fullName,
                    email: rawEmail || email,
                    phone,
                    reason: rejectReason
                });
                continue; // ❌ REJECT: skip duplicate record
            }

            // Ensure auto-generated email does not conflict with existing database records
            if (!rawEmail && (existingEmailSet.has(email) || inBatchEmails.has(email))) {
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                email = `${normalizeText(fullName)}${randomSuffix}@school.com`;
            }

            // Mark in-batch identifiers as seen
            if (email) inBatchEmails.add(email);
            if (aadhaarNumber) inBatchAadhaars.add(aadhaarNumber);
            if (!isDummyPhone(phone)) {
                inBatchPhones.add(phone);
                inBatchNamePhone.add(namePhoneKey);
            }

            // Date of birth parsing
            let parsedDob = null;
            if (row.dob || row.dateOfBirth) {
                const d = new Date(row.dob || row.dateOfBirth);
                if (!isNaN(d.getTime())) parsedDob = d;
            }

            // Salary parsing (supports raw strings with currency symbols e.g. "₹35,000")
            let baseSalary = 25000;
            const rawSalary = row.baseSalary !== undefined ? row.baseSalary : row.salary;
            if (rawSalary !== undefined && rawSalary !== null && String(rawSalary).trim() !== '') {
                const parsedNum = Number(String(rawSalary).replace(/[^0-9.]/g, ''));
                if (!isNaN(parsedNum) && parsedNum > 0) baseSalary = parsedNum;
            }

            const highestQualification = String(row.highestQualification || row.qualification || row.degree || 'B.Ed').trim();
            const specialization = String(row.specialization || row.subject || row.subjectSpecialization || 'General').trim();
            const university = String(row.university || row.college || row.institute || '').trim();
            const experience = String(row.experience || row.exp || '1 Year').trim();
            const permanentAddress = String(row.permanentAddress || row.address || row.city || '').trim();
            const bloodGroup = String(row.bloodGroup || '').trim();
            const remarks = String(row.remarks || '').trim();
            const extraDuties = String(row.extraDuties || 'No').trim();
            const gender = String(row.gender || 'Male').trim();

            let hashedPassword = defaultHashedPassword;
            if (row.password) {
                hashedPassword = await bcrypt.hash(String(row.password), salt);
            }

            const newTeacher = new Teacher({
                fullName,
                email,
                phone: phone || '0000000000',
                password: hashedPassword,
                gender,
                dob: parsedDob,
                highestQualification,
                university,
                specialization,
                experience,
                baseSalary,
                permanentAddress,
                aadhaarNumber,
                bloodGroup,
                remarks,
                extraDuties,
                role: 'Teacher',
                status: 'Active'
            });

            try {
                const saved = await newTeacher.save();
                importedTeachers.push(saved);
                existingEmailSet.add(email);
            } catch (saveErr) {
                errors.push({ row: i + 1, name: fullName, error: saveErr.message });
            }
        }

        const message = importedTeachers.length > 0
            ? `Successfully imported ${importedTeachers.length} teachers.${rejected.length > 0 ? ` ${rejected.length} duplicate records were rejected.` : ''}`
            : `No new teachers imported. All ${rejected.length} records were rejected as duplicates.`;

        res.status(200).json({
            success: true,
            message,
            importedCount: importedTeachers.length,
            rejectedCount: rejected.length,
            totalRows: teachers.length,
            rejected,
            errors
        });
    } catch (error) {
        console.error("Bulk Import Teachers Error:", error);
        res.status(500).json({ success: false, message: error.message || "Bulk import failed." });
    }
});

module.exports = router;