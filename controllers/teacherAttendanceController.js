const TeacherAttendance = require('../models/TeacherAttendance');

// 1. Get Monthly Attendance for a Specific Teacher
exports.getTeacherMonthlyAttendance = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month } = req.query; // Format: "YYYY-MM"

    // Find records where date starts with the month string
    const records = await TeacherAttendance.find({
      teacherId,
      date: { $regex: `^${month}` } 
    });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendance" });
  }
};

// 2. Mark Single Attendance (Update or Create)
exports.markTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, date, status } = req.body;

    const record = await TeacherAttendance.findOneAndUpdate(
      { teacherId, date },
      { status },
      { new: true, upsert: true } // Create if not exists
    );

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Error updating attendance" });
  }
};

// 3. Get Daily Attendance for ALL Teachers
exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query; // Format: "YYYY-MM-DD"
    
    const records = await TeacherAttendance.find({ date });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching daily data" });
  }
};

// 4. Bulk Save Attendance (For the Daily Register)
exports.bulkSaveAttendance = async (req, res) => {
  try {
    const { records } = req.body; // Array of { teacherId, date, status }

    // Use bulkWrite for performance
    const operations = records.map(record => ({
      updateOne: {
        filter: { teacherId: record.teacherId, date: record.date },
        update: { status: record.status },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await TeacherAttendance.bulkWrite(operations);
    }

    res.json({ message: "Attendance saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving bulk attendance" });
  }
};