const Teacher = require("../models/Teacher");
const Class = require("../models/Class"); 
const bcrypt = require('bcryptjs'); 

// 1. Get all teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching teachers" });
  }
};

// 2. Add a new teacher
exports.addTeacher = async (req, res) => {
  try {
    const { 
      fullName, email, gender, dob, permanentAddress, aadhaarNumber, 
      bloodGroup, highestQualification, university, specialization, 
      remarks, extraDuties, password, role, status, phone 
    } = req.body;

    // A. Check duplicate email
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher with this email already exists" });
    }

    // B. Extract File Paths safely (Works perfectly with Cloudinary!)
    // If no file is uploaded, req.files might be undefined, so we use safe checks.
    const photoUrl = req.files && req.files['photo'] ? req.files['photo'][0].path : null;
    const resumeUrl = req.files && req.files['resume'] ? req.files['resume'][0].path : null;
    const idProofUrl = req.files && req.files['idProof'] ? req.files['idProof'][0].path : null;

    // C. 🔒 HASH PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // D. Create Object
    const newTeacher = new Teacher({
      fullName, email, gender, dob, permanentAddress, aadhaarNumber,
      bloodGroup, highestQualification, university, specialization,
      remarks, extraDuties, 
      password: hashedPassword, 
      role, status, phone,
      photoUrl, resumeUrl, idProofUrl 
    });

    await newTeacher.save();

    res.status(201).json({ message: "Teacher added successfully!", teacher: newTeacher });

  } catch (error) {
    console.error("Error adding teacher:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// 3. Update Teacher
exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // File updates safely
    if (req.files) {
      if (req.files['photo']) updates.photoUrl = req.files['photo'][0].path;
      if (req.files['resume']) updates.resumeUrl = req.files['resume'][0].path;
      if (req.files['idProof']) updates.idProofUrl = req.files['idProof'][0].path;
    }

    // ✅ PASSWORD UPDATE LOGIC
    if (updates.password && updates.password !== "") {
        const salt = await bcrypt.genSalt(10);
        updates.password = await bcrypt.hash(updates.password, salt);
    } else {
        delete updates.password; // Prevent saving an empty password
    }

    const updatedTeacher = await Teacher.findByIdAndUpdate(id, updates, { new: true });
    
    if (!updatedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ message: "Teacher updated successfully", teacher: updatedTeacher });
  } catch (error) {
    res.status(500).json({ message: "Error updating teacher", error: error.message });
  }
};

// 4. Delete Teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTeacher = await Teacher.findByIdAndDelete(id);

    if (!deletedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ message: "Teacher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting teacher", error: error.message });
  }
};

// ✅ 5. NEW: Get My Schedule (For Teacher Dashboard & Marks Entry)
exports.getMySchedule = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        
        // A. Check: Classes where this teacher is assigned as Class Teacher
        const classTeacherOf = await Class.findOne({
            $or: [
                { classTeacher: teacherId },
                { teacher: teacherId }
            ]
        })
        .populate('classTeacher', 'fullName email phone')
        .populate('subjects.subject', 'name')
        .populate('subjects.teacher', 'fullName email phone');

        const allClassesTeacherOf = await Class.find({
            $or: [
                { classTeacher: teacherId },
                { teacher: teacherId }
            ]
        })
        .populate('classTeacher', 'fullName email phone')
        .populate('subjects.subject', 'name')
        .populate('subjects.teacher', 'fullName email phone')
        .sort({ grade: 1, section: 1 });
        
        // B. Check: Classes where this teacher is assigned to subjects
        const subjectClasses = await Class.find({ "subjects.teacher": teacherId })
            .populate('classTeacher', 'fullName email phone')
            .populate('subjects.subject', 'name')
            .populate('subjects.teacher', 'fullName email phone')
            .sort({ grade: 1, section: 1 });

        // C. Combine into a unified, deduplicated schedule list
        const scheduleMap = new Map();

        // 1. First add subjectClasses
        subjectClasses.forEach(cls => {
            const mySubjects = (cls.subjects || [])
                .filter(sub => sub.teacher && (sub.teacher._id || sub.teacher).toString() === teacherId.toString())
                .map(s => (s.subject?.name || (typeof s.subject === 'string' ? s.subject : null)))
                .filter(Boolean);

            const isMonitor = (cls.classTeacher?._id || cls.classTeacher)?.toString() === teacherId.toString();

            // If mySubjects is empty (fallback), list all subjects of this class
            const displaySubjects = mySubjects.length > 0 
                ? mySubjects 
                : (cls.subjects || []).map(s => s.subject?.name).filter(Boolean);

            scheduleMap.set(cls._id.toString(), {
                _id: cls._id,
                grade: cls.grade,
                section: cls.section,
                isClassTeacher: isMonitor,
                subjects: displaySubjects.length > 0 ? displaySubjects : ["General"]
            });
        });

        // 2. Also ensure classes where teacher is Class Monitor are included in schedule
        allClassesTeacherOf.forEach(cls => {
            const key = cls._id.toString();
            if (!scheduleMap.has(key)) {
                const classSubjects = (cls.subjects || [])
                    .map(s => s.subject?.name || (typeof s.subject === 'string' ? s.subject : null))
                    .filter(Boolean);

                scheduleMap.set(key, {
                    _id: cls._id,
                    grade: cls.grade,
                    section: cls.section,
                    isClassTeacher: true,
                    subjects: classSubjects.length > 0 ? classSubjects : ["General"]
                });
            } else {
                scheduleMap.get(key).isClassTeacher = true;
            }
        });

        const schedule = Array.from(scheduleMap.values());

        // D. Send Response
        res.status(200).json({
            classTeacher: classTeacherOf, // Main Class Info
            assignedClasses: allClassesTeacherOf, // All assigned monitor classes
            schedule: schedule            // Unified Subject & Class Teaching Info
        });

    } catch (error) {
        console.error("Schedule Error:", error);
        res.status(500).json({ message: "Error fetching schedule" });
    }
};