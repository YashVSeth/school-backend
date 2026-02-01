const User = require("../models/User");

// @desc    Get all teachers
// @route   GET /api/teachers
const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-password");
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete a teacher
// @route   DELETE /api/teachers/:id
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    
    if (teacher && teacher.role === "teacher") {
      await teacher.deleteOne();
      res.json({ message: "Teacher removed" });
    } else {
      res.status(404).json({ message: "Teacher not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = { getTeachers, deleteTeacher };