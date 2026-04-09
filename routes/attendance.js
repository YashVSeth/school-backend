const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const TeacherAttendance = require('../models/TeacherAttendance'); // ✅ New Model
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

// 2.5 GET DAILY ATTENDANCE FOR A CLASS
router.get('/daily', protect, async (req, res) => {
  try {
    const { classId, date } = req.query;
    if (!classId || !date) {
      return res.status(400).json({ message: "classId and date are required" });
    }

    // Only exact date matching
    const attendance = await Attendance.findOne({
      classId: classId,
      date: new Date(date)
    });

    if (attendance) {
      res.json(attendance.records);
    } else {
      res.json([]); // No attendance taken yet for this date
    }
  } catch (err) {
    console.error("GET /daily ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch daily attendance" });
  }
});

// 2.6 GET BULK ATTENDANCE STATS FOR MULTIPLE STUDENTS
router.get('/stats/bulk', protect, async (req, res) => {
  try {
    const { studentIds } = req.query;
    if (!studentIds) return res.json({});

    const ids = studentIds.split(',');
    const allAttendance = await Attendance.find({
      'records.student': { $in: ids }
    });

    const statsMap = {};
    ids.forEach(id => { statsMap[id] = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 }; });

    allAttendance.forEach(att => {
      att.records.forEach(rec => {
        const sid = rec.student.toString();
        if (statsMap[sid]) {
          statsMap[sid].total++;
          if (rec.status === 'Present') statsMap[sid].present++;
          else if (rec.status === 'Absent') statsMap[sid].absent++;
          else if (rec.status === 'Late') statsMap[sid].late++;
        }
      });
    });

    Object.keys(statsMap).forEach(id => {
      const s = statsMap[id];
      s.percentage = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
    });

    res.json(statsMap);
  } catch (err) {
    console.error("GET /stats/bulk ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch bulk stats" });
  }
});

// ==========================================
// 🏫 TEACHER ATTENDANCE ROUTES (NEW API)
// ==========================================

// 3. GET DAILY: Fetch all teacher attendance for a specific date (e.g. 2026-02-25)
router.get('/teachers/daily', protect, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date is required" });

    // Returns an array of { teacherId, date, status }
    const dailyRecords = await TeacherAttendance.find({ date });
    res.json(dailyRecords);
  } catch (err) {
    console.error("GET /teachers/daily ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch daily attendance" });
  }
});

// 4. POST BULK: Save daily attendance for all teachers at once
router.post('/teachers/bulk', protect, async (req, res) => {
  try {
    const { records } = req.body;
    // records is an array like: [{ teacherId: "xx", date: "YYYY-MM-DD", status: "Present" }, ...]

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "Valid records array is required" });
    }

    // Upsert logic: if record exists for this date+teacher, update it. Else insert.
    const bulkOps = records.map(record => ({
      updateOne: {
        filter: { teacherId: record.teacherId, date: record.date },
        update: { $set: { status: record.status } },
        upsert: true
      }
    }));

    await TeacherAttendance.bulkWrite(bulkOps);

    res.status(201).json({ message: "Bulk Teacher Attendance Saved Successfully!" });
  } catch (err) {
    console.error("POST /teachers/bulk ERROR:", err.message);
    res.status(500).json({ message: "Failed to save bulk attendance" });
  }
});

// 5. GET INDIVIDUAL (HISTORY): Fetch historical attendance for a single teacher
// Example query: ?month=2026-02 (will only return records prefix-matching the month)
router.get('/teacher/:teacherId', protect, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month } = req.query; // YYYY-MM

    let query = { teacherId };

    if (month) {
      // Use a wildcard prefix search to find all YYYY-MM-DD strings that start with YYYY-MM
      query.date = { $regex: new RegExp(`^${month}`) };
    }

    const history = await TeacherAttendance.find(query).sort({ date: -1 });
    res.json(history);
  } catch (err) {
    console.error("GET /teacher/:id ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch historical attendance" });
  }
});

// 6. POST INDIVIDUAL: Save or Update a single day's attendance for a single teacher
router.post('/teacher', protect, async (req, res) => {
  try {
    const { teacherId, date, status } = req.body;

    if (!teacherId || !date || !status) {
      return res.status(400).json({ message: "teacherId, date, and status are required." });
    }

    const updatedRecord = await TeacherAttendance.findOneAndUpdate(
      { teacherId, date },
      { $set: { status } },
      { upsert: true, new: true } // upsert = true means insert if not exists
    );

    res.status(201).json({ message: "Teacher attendance updated.", record: updatedRecord });
  } catch (err) {
    console.error("POST /teacher ERROR:", err.message);
    res.status(500).json({ message: "Failed to update teacher status" });
  }
});

module.exports = router;