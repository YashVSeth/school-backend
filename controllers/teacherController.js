const Teacher = require("../models/Teacher");
const Class = require("../models/Class"); // ✅ Class Model Import (Schedule ke liye zaroori)
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

    // B. Extract File Paths
    const photoUrl = req.files['photo'] ? req.files['photo'][0].path : null;
    const resumeUrl = req.files['resume'] ? req.files['resume'][0].path : null;
    const idProofUrl = req.files['idProof'] ? req.files['idProof'][0].path : null;

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
    const updates = req.body;

    // File updates
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
        delete updates.password;
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

// ✅ 5. NEW: Get My Schedule (For Teacher Dashboard)
exports.getMySchedule = async (req, res) => {
    try {
        const teacherId = req.user._id;
        
        // A. Check: Kya ye teacher kisi class ka 'Class Teacher' (Monitor) hai?
        const classTeacherOf = await Class.findOne({ classTeacher: teacherId });
        
        // B. Check: Ye teacher kaunse subjects padha raha hai?
        const subjectClasses = await Class.find({ "subjects.teacher": teacherId })
                                          .populate('subjects.subject');

        // C. Subject Data Format karein
        const schedule = subjectClasses.map(cls => {
            const mySubjects = cls.subjects.filter(sub => 
                sub.teacher && sub.teacher.toString() === teacherId.toString()
            );

            return {
                _id: cls._id,
                grade: cls.grade,
                section: cls.section,
                subjects: mySubjects.map(s => s.subject ? s.subject.name : "Unknown")
            };
        });

        // D. Send Response
        res.status(200).json({
            classTeacher: classTeacherOf, // Main Class Info
            schedule: schedule            // Subject Teaching Info
        });

    } catch (error) {
        console.error("Schedule Error:", error);
        res.status(500).json({ message: "Error fetching schedule" });
    }
};