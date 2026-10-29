const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Get all subjects (requires authentication)
router.get('/', protect, async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: "Error fetching subjects" });
  }
});

// Add new subject (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Subject name is required" });
    }
    const newSubject = new Subject({ name, code, description });
    await newSubject.save();
    res.status(201).json(newSubject);
  } catch (err) {
    res.status(400).json({ message: "Error adding subject", error: err.message });
  }
});

// Delete subject (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Subject not found" });
    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting subject", error: err.message });
  }
});

module.exports = router;