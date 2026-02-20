const Student = require('../models/Student');
const Class = require('../models/Class'); // ✅ Class Model Import zaroor karein

// 1. Get My Students (Logged in Teacher ki Class)
exports.getMyStudents = async (req, res) => {
    try {
        const teacherId = req.user._id; // Logged in Teacher ki ID

        // 👇 Step A: Dhoondo ki ye Teacher kis Class ka "Class Teacher" hai
        const classAssigned = await Class.findOne({ classTeacher: teacherId });

        if (!classAssigned) {
            return res.status(200).json({ 
                message: "No Class Assigned", 
                className: "No Class Assigned",
                students: [] 
            });
        }

        // 👇 Step B: Agar Class mil gayi, toh us class ke bachhe dhoondo
        const students = await Student.find({ classId: classAssigned._id });

        res.status(200).json({
            className: classAssigned.className, // e.g., "Class 10-A"
            classId: classAssigned._id,
            students: students
        });

    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Server Error" });
    }
};