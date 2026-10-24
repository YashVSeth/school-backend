const Student = require("../models/Student");
const User = require("../models/User");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Attendance = require("../models/Attendance");
const TeacherAttendance = require("../models/TeacherAttendance");
const Fee = require("../models/Fee");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const Mark = require("../models/Mark");
const Expense = require("../models/Expense");
const LeaveRequest = require("../models/LeaveRequest");
const Schedule = require("../models/Schedule");

// @desc    Get System Stats (Counts)
// @route   GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const studentCount = await Student.countDocuments();
    const teacherCount = await User.countDocuments({ role: "teacher" });
    const classCount = await Class.countDocuments();

    const students = await Student.find();
    let totalPresent = 0;
    let totalDays = 0;

    students.forEach(student => {
        if (student.attendance && student.attendance.length > 0) {
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
      attendancePercentage: attendancePercentage.toFixed(1)
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
};

// @desc    Get counts of each operational data collection
// @route   GET /api/admin/data-counts
const getDataCounts = async (req, res) => {
  try {
    const [
      students,
      teachers,
      classes,
      studentAttendance,
      teacherAttendance,
      fees,
      transactions,
      marks,
      expenses,
      leaves
    ] = await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(),
      Class.countDocuments(),
      Attendance.countDocuments(),
      TeacherAttendance.countDocuments(),
      Fee.countDocuments(),
      Transaction.countDocuments(),
      Mark.countDocuments(),
      Expense.countDocuments(),
      LeaveRequest.countDocuments()
    ]);

    res.status(200).json({
      students,
      teachers,
      classes,
      attendance: studentAttendance + teacherAttendance,
      fees: fees + transactions,
      marks,
      expenses,
      leaves,
      totalRecords: students + teachers + classes + studentAttendance + teacherAttendance + fees + transactions + marks + expenses + leaves
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching data counts", error: error.message });
  }
};

// @desc    Clear specific or all operational data (Admin only)
// @route   POST /api/admin/clear-data
const clearData = async (req, res) => {
  try {
    const { target } = req.body;

    if (!target) {
      return res.status(400).json({ message: "Please specify target data to clear." });
    }

    let result = {};

    switch (target) {
      case 'all':
        // Deletes operational data but PRESERVES admin accounts!
        const delStudents = await Student.deleteMany({});
        const delTeachers = await Teacher.deleteMany({});
        const delTeacherUsers = await User.deleteMany({ role: { $ne: 'admin' } });
        const delClasses = await Class.deleteMany({});
        const delAtt = await Attendance.deleteMany({});
        const delTAtt = await TeacherAttendance.deleteMany({});
        const delFees = await Fee.deleteMany({});
        const delTrans = await Transaction.deleteMany({});
        const delInv = await Invoice.deleteMany({});
        const delMarks = await Mark.deleteMany({});
        const delExp = await Expense.deleteMany({});
        const delLeaves = await LeaveRequest.deleteMany({});
        const delSched = await Schedule.deleteMany({});

        result = {
          message: "All operational data has been completely cleared. Admin accounts are preserved.",
          deletedCounts: {
            students: delStudents.deletedCount,
            teachers: delTeachers.deletedCount,
            classes: delClasses.deletedCount,
            attendance: delAtt.deletedCount + delTAtt.deletedCount,
            fees: delFees.deletedCount + delTrans.deletedCount + delInv.deletedCount,
            marks: delMarks.deletedCount,
            expenses: delExp.deletedCount,
            leaves: delLeaves.deletedCount,
            schedules: delSched.deletedCount
          }
        };
        break;

      case 'students':
        const resStudents = await Student.deleteMany({});
        await Attendance.deleteMany({});
        await Mark.deleteMany({});
        result = {
          message: "All student profiles, attendance, and exam marks have been cleared.",
          deletedCount: resStudents.deletedCount
        };
        break;

      case 'teachers':
        const resTeachers = await Teacher.deleteMany({});
        await User.deleteMany({ role: 'teacher' });
        await TeacherAttendance.deleteMany({});
        result = {
          message: "All teacher profiles and teacher login credentials have been cleared.",
          deletedCount: resTeachers.deletedCount
        };
        break;

      case 'classes':
        const resClasses = await Class.deleteMany({});
        result = {
          message: "All classes have been cleared.",
          deletedCount: resClasses.deletedCount
        };
        break;

      case 'attendance':
        const sAtt = await Attendance.deleteMany({});
        const tAtt = await TeacherAttendance.deleteMany({});
        await Student.updateMany({}, { $set: { attendance: [] } });
        result = {
          message: "All student and teacher attendance records have been cleared.",
          deletedCount: sAtt.deletedCount + tAtt.deletedCount
        };
        break;

      case 'fees':
        const dFees = await Fee.deleteMany({});
        const dTrans = await Transaction.deleteMany({});
        const dInv = await Invoice.deleteMany({});
        result = {
          message: "All fee records, transactions, and invoices have been cleared.",
          deletedCount: dFees.deletedCount + dTrans.deletedCount + dInv.deletedCount
        };
        break;

      case 'marks':
        const dMarks = await Mark.deleteMany({});
        result = {
          message: "All examination marks and result cards have been cleared.",
          deletedCount: dMarks.deletedCount
        };
        break;

      case 'expenses':
        const dExp = await Expense.deleteMany({});
        result = {
          message: "All expense tracking records have been cleared.",
          deletedCount: dExp.deletedCount
        };
        break;

      case 'leaves':
        const dLeaves = await LeaveRequest.deleteMany({});
        result = {
          message: "All leave applications have been cleared.",
          deletedCount: dLeaves.deletedCount
        };
        break;

      default:
        return res.status(400).json({ message: "Invalid target specified." });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error clearing data:", error);
    res.status(500).json({ message: "Failed to clear data", error: error.message });
  }
};

module.exports = { getStats, getDataCounts, clearData };