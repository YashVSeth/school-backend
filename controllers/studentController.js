const Student = require('../models/Student');

// --- 1. Add Student (Updated with Validation & Auto ID) ---
exports.addStudent = async (req, res) => {
  try {
    // Generate a random Student ID if missing
    const generatedId = "STU" + Math.floor(1000 + Math.random() * 9000);
    
    // Extract data
    const { 
      firstName, 
      lastName, 
      email, 
      class: studentClass, 
      phone, 
      fatherName,
      studentId
    } = req.body;

    // Basic Validation
    if (!firstName || !studentClass || !phone || !fatherName) {
      return res.status(400).json({ 
        message: "Missing required fields: First Name, Class, Phone, and Father's Name." 
      });
    }

    const newStudent = new Student({
      studentId: studentId || generatedId,
      firstName,
      lastName,
      email,
      class: studentClass,
      phone,
      fatherName,
      // Add other fields from your model if needed (address, gender, etc.)
      ...req.body 
    });

    const savedStudent = await newStudent.save();
    res.status(201).json(savedStudent);

  } catch (error) {
    console.error("Add Student Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Get All Students ---
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find().populate('class', 'grade section'); // Populates class details if they exist
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
    res.json({ message: "Student removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 4. Mark Attendance (Placeholder to prevent crash) ---
exports.markAttendance = async (req, res) => {
  try {
    // Logic to be implemented or imported from attendanceController
    res.status(200).json({ message: "Attendance logic pending" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ❌ DO NOT ADD 'module.exports = { ... }' AT THE BOTTOM
// The 'exports.funcName' syntax above handles it automatically.