const express = require("express");
const router = express.Router();
const Class = require('../models/Class');

// Import Controller and Middleware
const { addClass, getClasses } = require("../controllers/classController");
const protect = require("../middleware/authMiddleware");

// Debugging: If these log as "undefined", we know which file is broken
if (!addClass) console.error("❌ ERROR: addClass is missing!");
if (!protect) console.error("❌ ERROR: protect middleware is missing!");

// Routes
router.post("/", protect, addClass);
router.get("/", protect, getClasses);
router.get('/', async (req, res) => {
    // Populate subjects and teachers so we can see their names in the frontend
    const classes = await Class.find().populate('subjects.subject').populate('subjects.teacher');
    res.json(classes);
});

router.post('/', async (req, res) => {
    try {
        const newClass = new Class(req.body);
        await newClass.save();
        res.status(201).json(newClass);
    } catch(err) { res.status(500).json(err); }
});

// NEW: Update Class (Assign Subjects/Teachers)
router.put('/:id', async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, // Updates the fields sent in body
      { new: true }
    ).populate('subjects.subject').populate('subjects.teacher');
    
    res.json(updatedClass);
  } catch (err) {
    res.status(500).json({ message: "Error updating class" });
  }
});


// ... (Your existing GET, POST, PUT routes remain here) ...

// NEW: Delete Class
router.delete('/:id', async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: "Class deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting class" });
  }
});

module.exports = router;