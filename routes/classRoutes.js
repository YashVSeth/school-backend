const express = require("express");
const router = express.Router();
const Class = require('../models/Class');

// ✅ FIXED: Use curly braces to get the specific function
const { protect } = require("../middleware/authMiddleware");

// Import Controllers
const { 
  addClass, 
  getClasses, 
  updateFeeStructure 
} = require("../controllers/classController");

// Debugging Checks
if (!addClass) console.error("❌ ERROR: addClass is missing in classController!");
if (!updateFeeStructure) console.error("❌ ERROR: updateFeeStructure is missing in classController!");

// --- ROUTES ---

// 1. FEE STRUCTURE ROUTE (Must be defined BEFORE /:id routes)
router.post('/fee-structure', protect, updateFeeStructure);

// 2. Standard Routes
router.post("/", protect, addClass);
router.get("/", protect, getClasses);

// 3. Update Class (Assign Subjects/Teachers)
router.put('/:id', async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true }
    ).populate('subjects.subject').populate('subjects.teacher');
    
    res.json(updatedClass);
  } catch (err) {
    res.status(500).json({ message: "Error updating class" });
  }
});

// 4. Delete Class
router.delete('/:id', async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: "Class deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting class" });
  }
});

module.exports = router;