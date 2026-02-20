const Student = require('../models/Student');

// --- 1. Add Student (Synced with Frontend Payload) ---
exports.addStudent = async (req, res) => {
  try {
    const { 
      studentId, firstName, lastName, fatherName, motherName, phone, 
      email, address, dob, gender, bloodGroup, class: studentClass, 
      whatsappEnabled, feeDetails, height, weight // ✅ Added height & weight
    } = req.body;

    // Validation
    if (!firstName || !studentClass || !phone || !fatherName || !studentId) {
      return res.status(400).json({ message: "Required fields missing." });
    }

    // Duplicate Check
    const existing = await Student.findOne({ studentId });
    if (existing) {
      return res.status(400).json({ message: `Student ID ${studentId} is already in use.` });
    }

    const newStudent = new Student({
      studentId, firstName, lastName, fatherName, motherName, phone, 
      email, address, dob, gender, bloodGroup, class: studentClass, 
      height, // ✅ MUST BE HERE TO SAVE TO DB
      weight, // ✅ MUST BE HERE TO SAVE TO DB
      whatsappEnabled: whatsappEnabled ?? true,
      feeDetails: {
        backlog_2024: 0,
        backlog_2025: 0,
        tuitionFee_2026: 0,
        electricalCharges: 0,
        isUsingTransport: feeDetails?.isUsingTransport || false
      }
    });

    const savedStudent = await newStudent.save();
    res.status(201).json({ success: true, message: "Student Admitted Successfully!", data: savedStudent });

  } catch (error) {
    console.error("Add Student Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Database Conflict: ID already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Get All Students (With Population) ---
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find()
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
      const updatedStudent = await Student.findByIdAndUpdate(
        req.params.id, 
        req.body, 
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