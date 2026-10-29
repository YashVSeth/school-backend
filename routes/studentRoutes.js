const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Memory storage for Google Drive upload stream
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Import Controller Functions
const { 
    addStudent, 
    getStudents, 
    markAttendance, 
    deleteStudent,
    updateStudent,
    bulkImportStudents,
    reassignAllRollNumbers
} = require("../controllers/studentController");

// --- ROUTES ---
router.post("/reassign-roll-numbers", protect, adminOnly, reassignAllRollNumbers);
router.post("/bulk-import", protect, adminOnly, bulkImportStudents);
router.get("/class/:classId", protect, async (req, res) => {
  try {
    const { classId } = req.params;
    const Student = require("../models/Student");

    // Auto-assign roll numbers alphabetically if missing
    const unassignedCount = await Student.countDocuments({
      class: classId,
      $or: [{ rollNo: null }, { rollNo: { $exists: false } }]
    });

    if (unassignedCount > 0) {
      const studentsToAssign = await Student.find({ class: classId })
        .collation({ locale: 'en', strength: 2 })
        .sort({ firstName: 1, lastName: 1 });

      if (studentsToAssign.length > 0) {
        const bulkOps = studentsToAssign.map((s, idx) => ({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: { rollNo: idx + 1 } }
          }
        }));
        await Student.bulkWrite(bulkOps);
      }
    }

    const students = await Student.find({ class: classId })
      .populate('class', 'grade section')
      .sort({ rollNo: 1, firstName: 1 });

    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/", protect, adminOnly, upload.single('photo'), addStudent);
router.get("/", protect, getStudents);
router.post("/attendance", protect, markAttendance); 
router.delete("/:id", protect, adminOnly, deleteStudent);
router.put("/:id", protect, adminOnly, upload.single('photo'), updateStudent);

module.exports = router;