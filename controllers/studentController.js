const Student = require('../models/Student');
const Class = require('../models/Class');
const FeeStructure = require('../models/FeeStructure');
const Invoice = require('../models/Invoice');
const { uploadToGoogleDrive } = require('../config/googleDrive');

// --- HELPER: Student Photo Uploader (Google Drive with Base64 fallback) ---
const uploadStudentPhoto = async (file) => {
  if (!file) return null;

  // 1. Upload to Google Drive (Student Folder)
  try {
    const studentFolderId = process.env.GOOGLE_DRIVE_STUDENT_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const driveRes = await uploadToGoogleDrive(
      file.buffer,
      `student_${file.originalname}`,
      file.mimetype,
      studentFolderId
    );
    if (driveRes && driveRes.url) {
      console.log(`✅ Student photo uploaded to Drive: ${driveRes.url}`);
      return driveRes.url;
    }
  } catch (driveErr) {
    console.warn("⚠️ Google Drive upload notice:", driveErr.message);
  }

  // 2. Fallback to inline Base64 Data URI (Guaranteed to always display)
  const mime = file.mimetype || 'image/jpeg';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
};

// --- HELPER: Auto-Assign Roll Numbers Alphabetically ---
const assignAlphabeticalRollNumbers = async (classId) => {
  try {
    // Fetch all students in this class, sorted by First Name -> Last Name
    const students = await Student.find({ class: classId }).sort({ firstName: 1, lastName: 1 });

    if (students.length === 0) return;

    // Prepare bulkWrite operations to efficiently update all roll numbers
    const bulkOps = students.map((student, index) => ({
      updateOne: {
        filter: { _id: student._id },
        update: { $set: { rollNo: index + 1 } }
      }
    }));

    await Student.bulkWrite(bulkOps);
    console.log(`✅ Alphabetical Roll Numbers reassigned for Class ${classId}`);
  } catch (error) {
    console.error("❌ Failed to reassign Roll Numbers:", error);
  }
};

// --- 1. Add Student (Synced with Frontend Payload & Google Drive Photo Upload) ---
exports.addStudent = async (req, res) => {
  try {
    const {
      firstName, lastName, fatherName, motherName, phone,
      email, address, dob, gender, bloodGroup, class: studentClass,
      whatsappEnabled, feeDetails, height, weight, photo
    } = req.body;

    // Validation
    if (!firstName || !studentClass || !phone || !fatherName) {
      return res.status(400).json({ message: "Required fields missing." });
    }

    // Photo Upload (Google Drive with Cloudinary & Data URI fallback)
    let photoUrl = photo || null;
    if (req.file) {
      photoUrl = await uploadStudentPhoto(req.file);
    }

    // Auto-Generate secure anonymous Student ID to satisfy unique schema constraint
    const generatedStudentId = `STU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const newStudent = new Student({
      studentId: generatedStudentId,
      firstName, lastName, fatherName, motherName, phone,
      email, address, dob, gender, bloodGroup, class: studentClass,
      height,
      weight,
      photo: photoUrl,
      whatsappEnabled: whatsappEnabled ?? true,
      feeDetails: {
        backlog_2024: 0,
        backlog_2025: 0,
        tuitionFee_2026: 0,
        electricalCharges: 0,
        isUsingTransport: feeDetails?.isUsingTransport || false,
        transportRoute: feeDetails?.transportRoute || "",
        transportFee: feeDetails?.transportFee || 0
      }
    });

    const savedStudent = await newStudent.save();

    // Trigger the Alphabetical Sorter
    await assignAlphabeticalRollNumbers(studentClass);

    // --- AUTO-GENERATE TRANSPORT INVOICE ---
    if (savedStudent.feeDetails?.isUsingTransport && savedStudent.feeDetails?.transportFee > 0) {
      try {
        const title = `Transport (${savedStudent.feeDetails.transportRoute})`;
        const feeStructure = await FeeStructure.findOne({ classId: studentClass }).sort({ createdAt: -1 });

        const newInvoice = new Invoice({
          student: savedStudent._id,
          title: title,
          amount: savedStudent.feeDetails.transportFee,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Due in 15 days
          status: 'Pending',
          amountPaid: 0,
          academicYear: feeStructure ? feeStructure.academicYear : '2026-27'
        });

        await newInvoice.save();
        console.log(`✅ Auto-generated Transport Invoice for ${savedStudent.studentId}`);
      } catch (err) {
        console.error("❌ Failed to auto-generate Transport invoice:", err);
      }
    }

    res.status(201).json({ success: true, message: "Student Admitted Successfully!", data: savedStudent });

  } catch (error) {
    console.error("Add Student Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Database Conflict: ID already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Get All Students (With Population & Search) ---
exports.getStudents = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
        query = {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } }
            ]
        };
    }

    const students = await Student.find(query)
      .populate('class', 'grade section')
      .sort({ firstName: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 3. Delete Student ---
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    await student.deleteOne();
    res.json({ message: "Student record removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 4. Mark Attendance Placeholder ---
exports.markAttendance = async (req, res) => {
  res.status(200).json({ message: "Attendance module integrated" });
};

// --- 5. PROMOTE STUDENT ---
exports.promoteStudent = async (req, res) => {
  try {
    const { studentId, newClassId } = req.body;

    if (!studentId || !newClassId) {
      return res.status(400).json({ message: "Student ID and New Class are required" });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { class: newClassId },
      { new: true }
    ).populate('class');

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student Promoted Successfully", student: updatedStudent });

  } catch (error) {
    console.error("Promotion Error:", error);
    res.status(500).json({ message: "Failed to promote student" });
  }
};

// --- ✅ 6. UPDATE STUDENT (REQUIRED FOR EDIT MODAL) ---
exports.updateStudent = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Photo Upload on Edit (Google Drive with Cloudinary & Data URI fallback)
    if (req.file) {
      updateData.photo = await uploadStudentPhoto(req.file);
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ success: true, message: "Student Updated Successfully!", data: updatedStudent });
  } catch (error) {
    console.error("Update Student Error:", error);
    res.status(500).json({ message: error.message || "Failed to update student" });
  }
};

// --- 7. BULK IMPORT STUDENTS FROM EXCEL ---
exports.bulkImportStudents = async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "No student records provided for import." });
    }

    const classes = await Class.find({});
    const classMap = new Map();
    classes.forEach(c => {
      const key1 = `${c.grade}-${c.section}`.toLowerCase().replace(/\s+/g, '');
      const key2 = `${c.grade}`.toLowerCase().trim();
      const key3 = `class${c.grade}-${c.section}`.toLowerCase().replace(/\s+/g, '');
      const key4 = `class${c.grade}`.toLowerCase().trim();
      classMap.set(key1, c._id);
      if (!classMap.has(key2)) classMap.set(key2, c._id);
      classMap.set(key3, c._id);
      if (!classMap.has(key4)) classMap.set(key4, c._id);
      classMap.set(c._id.toString(), c._id);
    });

    const fallbackClassId = classes.length > 0 ? classes[0]._id : null;
    if (!fallbackClassId) {
      return res.status(400).json({ success: false, message: "Please create at least one Class in the system before importing students." });
    }

    const importedStudents = [];
    const errors = [];
    const affectedClassIds = new Set();

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rawName = String(row.fullName || row.name || `${row.firstName || ''} ${row.lastName || ''}`).trim();
      if (!rawName) {
        errors.push({ row: i + 1, error: "Missing student name" });
        continue;
      }

      const nameParts = rawName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '.';
      const phone = String(row.phone || row.mobile || row.contact || '0000000000').trim();
      const fatherName = String(row.fatherName || row.father || 'Parent').trim();
      const motherName = String(row.motherName || row.mother || '').trim();

      // Resolve class
      let targetClassId = fallbackClassId;
      if (row.class || row.grade) {
        const rawClass = String(row.class || row.grade).toLowerCase().replace(/\s+/g, '');
        if (classMap.has(rawClass)) {
          targetClassId = classMap.get(rawClass);
        } else {
          const digits = rawClass.replace(/\D/g, '');
          if (digits && classMap.has(digits)) {
            targetClassId = classMap.get(digits);
          }
        }
      }

      const studentId = row.studentId || `STU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000) + i}`;

      const newStudent = new Student({
        studentId,
        firstName,
        lastName,
        fatherName,
        motherName,
        phone,
        email: row.email || '',
        address: row.address || '',
        dob: row.dob ? new Date(row.dob) : null,
        gender: row.gender || 'Male',
        bloodGroup: row.bloodGroup || '',
        aadharNo: String(row.aadharNo || row.aadhar || ''),
        previousSchool: row.previousSchool || '',
        height: String(row.height || ''),
        weight: String(row.weight || ''),
        class: targetClassId,
        whatsappEnabled: row.whatsappEnabled !== false,
        feeDetails: {
          backlog_2024: Number(row.backlog_2024) || 0,
          backlog_2025: Number(row.backlog_2025) || 0,
          tuitionFee_2026: Number(row.tuitionFee_2026) || 0,
          electricalCharges: Number(row.electricalCharges) || 0,
          isUsingTransport: Boolean(row.isUsingTransport || row.transportRoute),
          transportRoute: row.transportRoute || '',
          transportFee: Number(row.transportFee) || 0
        }
      });

      try {
        const saved = await newStudent.save();
        importedStudents.push(saved);
        affectedClassIds.add(targetClassId.toString());
      } catch (saveErr) {
        errors.push({ row: i + 1, name: rawName, error: saveErr.message });
      }
    }

    // Reassign roll numbers for all affected classes
    for (const classId of affectedClassIds) {
      await assignAlphabeticalRollNumbers(classId);
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importedStudents.length} students.`,
      importedCount: importedStudents.length,
      totalRows: students.length,
      errors
    });
  } catch (error) {
    console.error("Bulk Import Students Error:", error);
    res.status(500).json({ success: false, message: error.message || "Bulk import failed." });
  }
};