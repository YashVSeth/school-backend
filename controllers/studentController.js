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
    if (!classId) return;
    // Fetch all students in this class, sorted alphabetically by First Name -> Last Name (case-insensitive)
    const students = await Student.find({ class: classId })
      .collation({ locale: 'en', strength: 2 })
      .sort({ firstName: 1, lastName: 1 });

    if (students.length === 0) return;

    // Prepare bulkWrite operations to efficiently update all roll numbers class-wise (1, 2, 3...)
    const bulkOps = students.map((student, index) => ({
      updateOne: {
        filter: { _id: student._id },
        update: { $set: { rollNo: index + 1 } }
      }
    }));

    await Student.bulkWrite(bulkOps);
    console.log(`✅ Alphabetical Roll Numbers (1 to ${students.length}) assigned for Class ${classId}`);
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

// --- 2. Get All Students (With Population, Class Filter & Search) ---
exports.getStudents = async (req, res) => {
  try {
    const { search, classId, class: classParam, grade, status } = req.query;
    let query = {};

    // Auto-allot class-wise alphabetical roll numbers if any student has no roll number
    const unassignedCount = await Student.countDocuments({
      $or: [{ rollNo: null }, { rollNo: { $exists: false } }]
    });

    if (unassignedCount > 0) {
      const allClassIds = await Student.distinct('class');
      for (const cId of allClassIds.filter(Boolean)) {
        await assignAlphabeticalRollNumbers(cId);
      }
    }

    // 1. Status Filter
    if (status) {
      query.status = status;
    }

    // 2. Class Filter (by class ObjectId or Grade string)
    const targetClassId = classId || classParam;
    if (targetClassId && targetClassId !== 'all' && targetClassId !== '') {
      query.class = targetClassId;
    } else if (grade) {
      const matchedClasses = await Class.find({ grade: { $regex: grade, $options: 'i' } }).select('_id');
      if (matchedClasses.length > 0) {
        query.class = { $in: matchedClasses.map(c => c._id) };
      }
    }

    // 3. Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim();
      const orConditions = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } }
      ];
      if (!isNaN(q) && q !== '') {
        orConditions.push({ rollNo: Number(q) });
      }
      query.$or = orConditions;
    }

    const students = await Student.find(query)
      .populate('class', 'grade section')
      .sort({ rollNo: 1, firstName: 1 });

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

    // Roman numeral to Arabic number converter
    const romanMap = {
      'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
      'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
      'xi': 11, 'xii': 12
    };

    // Smart class & section parser (handles "Class 6", "6th", "VI", "VIth", "Std 7", "6-A", "7B", etc.)
    const parseClassInfo = (rawClass, rawSec = '') => {
      let str = String(rawClass || '').trim();
      let sec = String(rawSec || '').trim().toUpperCase();

      if (!str) return { grade: '', section: sec };

      const lower = str.toLowerCase().replace(/\./g, '').trim();

      // Pre-primary aliases
      if (/^nurs(ery)?$/.test(lower) || lower === 'nur') return { grade: 'Nursery', section: sec };
      if (/^lkg$|^lowerkg$|^lowerkindergarten$|^kg1$|^kg-1$/.test(lower)) return { grade: 'LKG', section: sec };
      if (/^ukg$|^upperkg$|^upperkindergarten$|^kg2$|^kg-2$/.test(lower)) return { grade: 'UKG', section: sec };
      if (/^play(group)?$/.test(lower) || /^prenur(s(ery)?)?$/.test(lower)) return { grade: 'Pre-Nursery', section: sec };

      // Strip common prefixes e.g. "class", "std", "standard", "grade"
      let cleaned = str.replace(/^(class|std|standard|grade)\s*[-:]?\s*/i, '').trim();

      // 1. Check for embedded section with explicit separator: e.g. '2-A', '2 A', 'VI-A', 'VI A', '6th A', '3 - B'
      const explicitSep = cleaned.match(/^([0-9]{1,2}(?:st|nd|rd|th)?|[ivx]+(?:st|nd|rd|th)?)\s*[-/ ]\s*([a-z])$/i);
      let gradePart = cleaned;
      if (explicitSep) {
        gradePart = explicitSep[1];
        if (!sec) sec = explicitSep[2].toUpperCase();
      } else {
        // 2. Only allow unseparated section if it's DIGITS + single letter e.g. '2A', '2B', '3A', '6A', '10B'
        // NOTE: NEVER split Roman numerals without a separator (e.g. 'II', 'III', 'VI', 'VII' are whole roman numerals!)
        const digitLetter = cleaned.match(/^([0-9]{1,2}(?:st|nd|rd|th)?)\s*([a-z])$/i);
        if (digitLetter) {
          gradePart = digitLetter[1];
          if (!sec) sec = digitLetter[2].toUpperCase();
        }
      }

      // Remove ordinal suffixes e.g. 6th -> 6, 1st -> 1, 2nd -> 2, 3rd -> 3, IInd -> II, IIIrd -> III, VIth -> VI
      const cleanGrade = gradePart.toLowerCase().replace(/(st|nd|rd|th)$/i, '').trim();

      let num = null;
      if (/^\d+$/.test(cleanGrade)) {
        num = parseInt(cleanGrade, 10);
      } else if (romanMap[cleanGrade]) {
        num = romanMap[cleanGrade];
      }

      if (num && num >= 1 && num <= 12) {
        return { grade: 'Class ' + num, section: sec };
      }

      return { grade: str, section: sec };
    };

    const registerClassInMap = (c) => {
      const cId = c._id;
      const parsed = parseClassInfo(c.grade, c.section);
      const gradeStr = parsed.grade;
      const secStr = parsed.section || '';

      classMap.set(cId.toString(), cId);

      const keyGradeSec = `${gradeStr.toLowerCase()}-${secStr.toLowerCase()}`;
      classMap.set(keyGradeSec, cId);

      if (!secStr) {
        classMap.set(gradeStr.toLowerCase(), cId);
      } else {
        if (!classMap.has(gradeStr.toLowerCase())) {
          classMap.set(gradeStr.toLowerCase(), cId);
        }
      }

      const numMatch = gradeStr.match(/\d+/);
      if (numMatch) {
        const num = numMatch[0];
        const numSecKey = `${num}-${secStr.toLowerCase()}`;
        classMap.set(numSecKey, cId);
        if (!secStr && !classMap.has(num)) classMap.set(num, cId);
        if (!classMap.has(`class${num}`)) classMap.set(`class${num}`, cId);
        if (!classMap.has(`class ${num}`)) classMap.set(`class ${num}`, cId);
        if (!classMap.has(`${num}th`)) classMap.set(`${num}th`, cId);

        for (const [r, arabic] of Object.entries(romanMap)) {
          if (arabic === parseInt(num, 10)) {
            if (!secStr && !classMap.has(r)) classMap.set(r, cId);
            if (!classMap.has(`class${r}`)) classMap.set(`class${r}`, cId);
            if (!classMap.has(`class ${r}`)) classMap.set(`class ${r}`, cId);
            if (!classMap.has(`${r}th`)) classMap.set(`${r}th`, cId);
          }
        }
      }

      const rawGradeNorm = String(c.grade).toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
      if (!classMap.has(rawGradeNorm)) classMap.set(rawGradeNorm, cId);
      if (secStr) {
        classMap.set(`${rawGradeNorm}-${secStr.toLowerCase()}`, cId);
      }
    };

    classes.forEach(registerClassInMap);

    const fallbackClassId = classes.length > 0 ? classes[0]._id : null;
    if (!fallbackClassId) {
      return res.status(400).json({ success: false, message: "Please create at least one Class in the system before importing students." });
    }

    // ─── FAIL-CHECK & DUPLICATE DETECTION SYSTEM ───
    const isGenericFather = (f) => {
      const norm = String(f || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      return !norm || norm === 'parent' || norm === 'father' || norm === 'na' || norm === 'none' || norm === 'unknown' || norm.length < 3;
    };

    const isDummyPhone = (p) => {
      if (!p) return true;
      const digits = String(p).replace(/\D/g, '');
      return digits === '' || /^0+$/.test(digits) || /^9+$/.test(digits) || /^1+$/.test(digits) || digits === '1234567890';
    };

    // Build quick in-memory lookup sets from existing students
    const existingStudents = await Student.find({}, 'firstName lastName fatherName class phone aadharNo studentId');
    const existingStudentSet = new Set();
    const existingAadharSet = new Set();
    const existingPhoneNameSet = new Set();

    const normalizeText = (text) => String(text || '').trim().toLowerCase().replace(/\s+/g, '');

    existingStudents.forEach(s => {
      const fn = normalizeText(`${s.firstName} ${s.lastName || ''}`);
      const fnOnly = normalizeText(s.firstName);
      const fan = normalizeText(s.fatherName);
      const cid = String(s.class || '').trim();

      if (fan) {
        existingStudentSet.add(`${fn}|${fan}|${cid}`);
        if (!isGenericFather(fan) && fnOnly.length > 2) {
          existingStudentSet.add(`${fnOnly}|${fan}|${cid}`);
        }
      }

      if (s.aadharNo && s.aadharNo.trim()) {
        existingAadharSet.add(s.aadharNo.trim());
      }

      if (!isDummyPhone(s.phone)) {
        existingPhoneNameSet.add(`${fnOnly}|${s.phone.trim()}`);
      }
    });

    const inBatchSeenKeys = new Set();
    const inBatchAadhars = new Set();
    const importedStudents = [];
    const rejected = [];
    const errors = [];
    const affectedClassIds = new Set();

    // Helper phone cleaner
    const cleanPhone = (val) => {
      if (!val) return '';
      let s = String(val).trim();
      if (/e[+-]?\d+/i.test(s)) {
        const num = Number(s);
        if (!isNaN(num)) s = Math.round(num).toString();
      }
      s = s.replace(/\.0+$/, '');
      if (s.includes('/') || s.includes(',') || s.includes(';') || s.includes(' ')) {
        const parts = s.split(/[/,;\s]+/);
        for (const p of parts) {
          const cleanP = p.replace(/[^\d+]/g, '');
          const pDigits = cleanP.replace(/\D/g, '');
          if (pDigits.length >= 10 && pDigits.length <= 13) return cleanP;
        }
      }
      return s.replace(/[^\d+]/g, '') || s;
    };

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      const rawName = String(row.fullName || row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim()).trim();
      if (!rawName) {
        errors.push({ row: i + 1, error: "Missing student name" });
        continue;
      }

      const nameParts = rawName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '.';

      let rawPhone = row.phone;
      if (!rawPhone || rawPhone === '0000000000') {
        rawPhone = row.mobile || row.contact || row.mobileNo || row.mobNo || row.phoneNo || row.whatsapp || '';
      }
      if (!rawPhone || rawPhone === '0000000000') {
        for (const k of Object.keys(row)) {
          const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lk.includes('mobile') || lk.includes('phone') || lk.includes('contact') || lk.includes('mob')) {
            if (row[k] && String(row[k]).trim() !== '' && String(row[k]).trim() !== '0000000000') {
              rawPhone = row[k];
              break;
            }
          }
        }
      }
      const phone = cleanPhone(rawPhone) || '0000000000';
      const fatherName = String(row.fatherName || row.father || 'Parent').trim();
      const motherName = String(row.motherName || row.mother || '').trim();

      // Resolve class with smart matching & auto-creation
      const rawClassVal = row.class || row.grade || row.standard || row.std || row.className || row.studentClass || '';
      const rawSecVal = row.section || row.sec || '';

      const parsedClass = parseClassInfo(rawClassVal, rawSecVal);
      let targetClassId = null;

      if (parsedClass.grade) {
        const fullKey = `${parsedClass.grade.toLowerCase()}-${(parsedClass.section || '').toLowerCase()}`;
        const gradeKey = parsedClass.grade.toLowerCase();

        if (classMap.has(fullKey)) {
          targetClassId = classMap.get(fullKey);
        } else if (classMap.has(gradeKey)) {
          targetClassId = classMap.get(gradeKey);
        } else {
          const numMatch = parsedClass.grade.match(/\d+/);
          if (numMatch && classMap.has(numMatch[0])) {
            targetClassId = classMap.get(numMatch[0]);
          }
        }

        // Auto-create class if not existing yet (e.g. Class 7, Class 8)
        if (!targetClassId) {
          try {
            let existingInDb = await Class.findOne({
              grade: new RegExp(`^${parsedClass.grade}$`, 'i'),
              ...(parsedClass.section ? { section: new RegExp(`^${parsedClass.section}$`, 'i') } : {})
            });

            if (!existingInDb && !parsedClass.section) {
              existingInDb = await Class.findOne({
                grade: new RegExp(`^${parsedClass.grade}$`, 'i')
              });
            }

            if (existingInDb) {
              registerClassInMap(existingInDb);
              targetClassId = existingInDb._id;
            } else {
              const newClass = await Class.create({
                grade: parsedClass.grade,
                section: parsedClass.section || '',
                feeStructure: { monthlyFee: 0, yearlyFee: 0 },
                subjects: []
              });
              registerClassInMap(newClass);
              targetClassId = newClass._id;
            }
          } catch (createErr) {
            console.error("Error auto-creating class:", createErr);
          }
        }
      }

      if (!targetClassId) {
        targetClassId = fallbackClassId;
      }

      // ─── DUPLICATE / REJECTION CHECK ───
      const normFullName = normalizeText(`${firstName} ${lastName}`);
      const normFirstName = normalizeText(firstName);
      const normFather = normalizeText(fatherName);
      const studentClassKey = `${normFullName}|${normFather}|${targetClassId}`;
      const studentClassKeyShort = `${normFirstName}|${normFather}|${targetClassId}`;
      const aadharClean = String(row.aadharNo || row.aadhar || '').trim();

      let rejectReason = null;
      const isSpecificFather = !isGenericFather(normFather) && normFather.length > 2;

      if (existingStudentSet.has(studentClassKey) || (isSpecificFather && existingStudentSet.has(studentClassKeyShort))) {
        rejectReason = `Already enrolled in this class with same name and father's name.`;
      } else if (inBatchSeenKeys.has(studentClassKey) || (isSpecificFather && inBatchSeenKeys.has(studentClassKeyShort))) {
        rejectReason = `Duplicate: Appears multiple times in this uploaded file.`;
      } else if (aadharClean && (existingAadharSet.has(aadharClean) || inBatchAadhars.has(aadharClean))) {
        rejectReason = `Aadhar Number (${aadharClean}) is already registered to an existing student.`;
      } else if (!isDummyPhone(phone) && existingPhoneNameSet.has(`${normFirstName}|${phone}`)) {
        rejectReason = `Student with same name and mobile (${phone}) already registered.`;
      }

      if (rejectReason) {
        rejected.push({
          row: i + 1,
          name: rawName,
          fatherName,
          phone,
          reason: rejectReason
        });
        continue; // ❌ REJECT: Do not insert duplicate!
      }

      // Mark as seen in this batch
      inBatchSeenKeys.add(studentClassKey);
      if (isSpecificFather) inBatchSeenKeys.add(studentClassKeyShort);
      if (aadharClean) inBatchAadhars.add(aadharClean);
      if (!isDummyPhone(phone)) existingPhoneNameSet.add(`${normFirstName}|${phone}`);

      const studentId = row.studentId || `STU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000) + i}`;

      let parsedDob = null;
      if (row.dob) {
        const d = new Date(row.dob);
        if (!isNaN(d.getTime())) parsedDob = d;
      }

      const newStudent = new Student({
        studentId,
        firstName,
        lastName,
        fatherName,
        motherName,
        phone,
        email: row.email || '',
        address: row.address || '',
        dob: parsedDob,
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

    const message = importedStudents.length > 0
      ? `Import completed: ${importedStudents.length} students imported.${rejected.length > 0 ? ` ${rejected.length} duplicate records were rejected.` : ''}`
      : `No new students imported. All ${rejected.length} records were rejected as duplicates.`;

    res.status(200).json({
      success: true,
      message,
      importedCount: importedStudents.length,
      rejectedCount: rejected.length,
      totalRows: students.length,
      rejected,
      errors
    });
  } catch (error) {
    console.error("Bulk Import Students Error:", error);
    res.status(500).json({ success: false, message: error.message || "Bulk import failed." });
  }
};

// --- 7. Reassign Alphabetical Roll Numbers (A to Z) for Single or All Classes ---
exports.reassignAllRollNumbers = async (req, res) => {
  try {
    const { classId } = req.body;
    let classesToProcess = [];

    if (classId && classId !== 'all' && classId !== '') {
      classesToProcess = [classId];
    } else {
      const allClassIds = await Student.distinct('class');
      classesToProcess = allClassIds.filter(Boolean);
    }

    let totalUpdated = 0;
    for (const cId of classesToProcess) {
      // Fetch students in this class in true alphabetical order (A-Z) by First Name & Last Name
      const students = await Student.find({ class: cId })
        .collation({ locale: 'en', strength: 2 })
        .sort({ firstName: 1, lastName: 1 });

      if (students.length > 0) {
        const bulkOps = students.map((std, idx) => ({
          updateOne: {
            filter: { _id: std._id },
            update: { $set: { rollNo: idx + 1 } }
          }
        }));
        await Student.bulkWrite(bulkOps);
        totalUpdated += students.length;
      }
    }

    res.status(200).json({
      success: true,
      message: `Alphabetical Roll Numbers (1 to ${totalUpdated}) successfully assigned across ${classesToProcess.length} class(es)!`,
      totalUpdated
    });
  } catch (error) {
    console.error("Reassign Roll Numbers Error:", error);
    res.status(500).json({ message: "Failed to reassign roll numbers" });
  }
};