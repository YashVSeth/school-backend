const Student = require("../models/Student");
const User = require("../models/User");
const Class = require("../models/Class");

// @desc    Get System Stats (Counts)
// @route   GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const studentCount = await Student.countDocuments();
    const teacherCount = await User.countDocuments({ role: "teacher" });
    const classCount = await Class.countDocuments();

    // Calculate Average Attendance (Simple version)
    // This looks at all students and calculates the average % of "Present" status
    const students = await Student.find();
    let totalPresent = 0;
    let totalDays = 0;

    students.forEach(student => {
        if (student.attendance.length > 0) {
            const presents = student.attendance.filter(a => a.status === "Present").length;
            totalPresent += presents;
            totalDays += student.attendance.length;
        }
    });

    const attendancePercentage = totalDays === 0 ? 0 : (totalPresent / totalDays) * 100;

    res.status(200).json({
      studentCount,
      teacherCount,
      classCount,
      attendancePercentage: attendancePercentage.toFixed(1) // Round to 1 decimal
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats", error });
  }
};

module.exports = { getStats };