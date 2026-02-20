const express = require("express");
const router = express.Router();
const Class = require('../models/Class');
const { protect } = require("../middleware/authMiddleware");

// Import Controllers
const { 
  addClass, 
  getClasses, 
  updateFeeStructure,
  assignClassTeacher // ✅ IMPORTED (Ye missing tha)
} = require("../controllers/classController");

// Debugging Checks
if (!addClass) console.error("❌ ERROR: addClass is missing in classController!");
if (!assignClassTeacher) console.error("❌ ERROR: assignClassTeacher is missing in classController!");

// --- ROUTES ---

// 1. SPECIFIC ROUTES (Inhein hamesha upar rakhein)
router.put('/fee-structure', protect, updateFeeStructure); // Fees update
router.put('/assign', protect, assignClassTeacher);        // ✅ TEACHER ASSIGN ROUTE

// 2. STANDARD ROUTES
router.post("/", protect, addClass); // Create Class
router.get("/", protect, getClasses); // Get All Classes

// 3. DYNAMIC ID ROUTES (Inhein sabse neeche rakhein)

// GET SINGLE CLASS
router.get('/:id', protect, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid Class ID" });
    }

    const singleClass = await Class.findById(req.params.id)
      .populate('classTeacher', 'fullName email phone'); // ✅ FIXED: 'teacher' -> 'classTeacher'
      
    if (!singleClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(singleClass);
  } catch (err) {
    console.error("Fetch Class Error:", err);
    res.status(500).json({ message: "Server Error fetching class" });
  }
});

// UPDATE CLASS
router.put('/:id', protect, async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true }
    )
    .populate('classTeacher', 'fullName email'); // ✅ FIXED: 'teacher' -> 'classTeacher'
    
    if (!updatedClass) {
        return res.status(404).json({ message: "Class not found" });
    }

    res.json(updatedClass);
  } catch (err) {
    console.error("Update Class Error:", err);
    res.status(500).json({ message: "Error updating class" });
  }
});

// DELETE CLASS
router.delete('/:id', protect, async (req, res) => {
  try {
    const deletedClass = await Class.findByIdAndDelete(req.params.id);
    if (!deletedClass) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class deleted successfully" });
  } catch (err) {
    console.error("Delete Class Error:", err);
    res.status(500).json({ message: "Error deleting class" });
  }
});

module.exports = router;