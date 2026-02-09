const Student = require('../models/Student');

// --- 1. Add Student (Synced with Frontend Payload) ---
exports.addStudent = async (req, res) => {
  try {
    const { 
      studentId, 
      firstName, 
      lastName, 
      fatherName, 
      motherName, 
      phone, 
      email, 
      address, 
      dob, 
      gender, 
      bloodGroup, 
      class: studentClass, 
      whatsappEnabled, 
      feeDetails 
    } = req.body;

    // Validation: Match with Frontend 'required' fields
    if (!firstName || !studentClass || !phone || !fatherName || !studentId) {
      return res.status(400).json({ 
        message: "Required fields missing: Name, Student ID, Class, Phone, or Father's Name." 
      });
    }

    // Duplicate Check for Student ID (Manually checking to provide better error message)
    const existing = await Student.findOne({ studentId });
    if (existing) {
      return res.status(400).json({ message: `Student ID ${studentId} is already in use.` });
    }

    const newStudent = new Student({
      studentId,
      firstName,
      lastName,
      fatherName,
      motherName,
      phone,
      email,
      address,
      dob,
      gender,
      bloodGroup,
      class: studentClass,
      whatsappEnabled: whatsappEnabled ?? true, // Default to true if not provided
      feeDetails: {
        backlog_2024: 0, // Initially 0 as per your instruction
        backlog_2025: 0,
        tuitionFee_2026: 0,
        electricalCharges: 0,
        isUsingTransport: feeDetails?.isUsingTransport || false
      }
    });

    const savedStudent = await newStudent.save();
    res.status(201).json({ 
      success: true, 
      message: "Student Admitted Successfully!", 
      data: savedStudent 
    });

  } catch (error) {
    console.error("Add Student Error:", error);
    
    // Handle MongoDB Index Errors (like the enrollmentNo error you saw)
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Database Conflict: A student with this ID or unique field already exists." 
      });
    }
    
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Get All Students (With Population) ---
exports.getStudents = async (req, res) => {
  try {
    // Alphabetical order mein list mangwayein
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
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
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