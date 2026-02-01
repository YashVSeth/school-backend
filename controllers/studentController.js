const Student = require("../models/Student");
// ❌ REMOVED: const User = require("../models/User");
// ❌ REMOVED: const bcrypt = require("bcryptjs");

// Helper: Re-assign Roll Numbers Alphabetically
const reorderRollNumbers = async (classId) => {
  try {
    if (!classId) return;
    const students = await Student.find({ classId }).sort({ name: 1 });
    for (let i = 0; i < students.length; i++) {
      if (students[i].rollNum !== i + 1) {
        students[i].rollNum = i + 1;
        await students[i].save();
      }
    }
  } catch (err) {
    console.log("Auto-sort warning:", err.message);
  }
};

// @desc    Add a new student record (NO LOGIN CREATED)
const addStudent = async (req, res) => {
  try {
    let { 
      name, email, classId, // ❌ No password in request
      dob, gender, nationality, bloodGroup, photo 
    } = req.body;

    // 1. CLEAN UP EMPTY FIELDS
    if (!dob || dob === "") dob = undefined;
    if (!classId || classId === "") return res.status(400).json({ message: "Please select a Class" });
    
    // If email is empty string, make it null so unique index doesn't crash on multiple empty emails
    if (!email || email === "") email = null; 

    // 2. CREATE STUDENT PROFILE (Only this!)
    const newStudent = await Student.create({
      name,
      email,
      rollNum: 0, 
      classId,
      dob,
      gender,
      nationality,
      bloodGroup,
      photo
    });

    // 3. SORT ROLL NUMBERS
    await reorderRollNumbers(classId);

    res.status(201).json({ message: "Student Record Added Successfully" });
    
  } catch (error) {
    console.error("❌ BACKEND ERROR:", error);
    // Handle Duplicate Email Error specific to Student collection
    if (error.code === 11000) {
        return res.status(400).json({ message: "A student with this email already exists." });
    }
    res.status(500).json({ message: "Server Error: " + error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await Student.find().populate("classId", "grade section").sort({ classId: 1, rollNum: 1 });
    res.json(students);
  } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (student) {
      const classId = student.classId;
      // ❌ REMOVED: await User.findOneAndDelete... (No user to delete)
      await student.deleteOne();
      await reorderRollNumbers(classId);
      res.json({ message: "Student record removed" });
    } else { res.status(404).json({ message: "Student not found" }); }
  } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

// Keep markAttendance as is...
const markAttendance = async (req, res) => {
    const { date, students } = req.body; 
    try {
      const attendanceDate = new Date(date);
      for (const s of students) {
        const student = await Student.findById(s._id);
        if (student) {
          const alreadyMarked = student.attendance.find(
            (a) => new Date(a.date).toDateString() === attendanceDate.toDateString()
          );
          if (alreadyMarked) {
            alreadyMarked.status = s.status; 
          } else {
            student.attendance.push({ date: attendanceDate, status: s.status }); 
          }
          await student.save();
        }
      }
      res.status(200).json({ message: "Attendance Marked" });
    } catch (error) {
      res.status(500).json({ message: "Error marking attendance" });
    }
  };

module.exports = { addStudent, getStudents, deleteStudent, markAttendance };