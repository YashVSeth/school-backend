const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class'); 
const { protect } = require('../middleware/authMiddleware');

// 1. GET MY STUDENTS (SMART VERSION)
router.get('/my-students', protect, async (req, res) => {
  try {
    const teacherId = req.user.id;
    console.log("🔍 Teacher ID:", teacherId);

    // --- JADOO 🪄: 3 Tarike se Class Dhoondo ---
    // Code check karega ki Teacher kahan chupa hai:
    // 1. 'teacher' field mein?
    // 2. 'classTeacher' field mein?
    // 3. 'teacherId' field mein?
    
    const assignedClass = await Class.findOne({ 
        $or: [
            { teacher: teacherId }, 
            { classTeacher: teacherId },
            { teacherId: teacherId }
        ]
    });

    if (!assignedClass) {
      console.log("⚠️ Class Nahi Mili (Check Admin Panel)");
      return res.status(404).json({ message: "No class assigned to you yet." });
    }

    console.log("✅ Class Found:", assignedClass.grade, assignedClass.section);

    // Ab Students Dhoondo
    const students = await Student.find({ class: assignedClass._id })
                                  .sort({ firstName: 1 });

    res.json({
        classId: assignedClass._id,
        className: `${assignedClass.grade} - ${assignedClass.section}`,
        students: students
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// 2. MARK ATTENDANCE
router.post('/', protect, async (req, res) => {
  try {
    const { date, classId, records } = req.body;

    // Check agar aaj ki attendance pehle se hai
    let attendance = await Attendance.findOne({ 
      date: new Date(date), 
      classId: classId 
    });

    if (attendance) {
      attendance.records = records; // Update
      await attendance.save();
    } else {
      attendance = new Attendance({ // Create New
        date: new Date(date),
        classId,
        records
      });
      await attendance.save();
    }

    res.status(201).json({ message: "Attendance Saved Successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving attendance" });
  }
});

module.exports = router;