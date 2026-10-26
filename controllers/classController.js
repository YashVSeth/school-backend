const Class = require("../models/Class");

// 1. Add New Class
const addClass = async (req, res) => {
  try {
    const { grade, section } = req.body;

    if (!grade) {
      return res.status(400).json({ message: "Grade is required" });
    }

    const cleanSection = section ? String(section).trim() : "";

    // Check Duplicate
    const existingClass = await Class.findOne({ grade, section: cleanSection });
    if (existingClass) {
      return res.status(400).json({ 
        message: cleanSection 
          ? `Class ${grade} - ${cleanSection} already exists` 
          : `Class ${grade} already exists` 
      });
    }

    const newClass = new Class({
      grade: String(grade).trim(),
      section: cleanSection
    });

    await newClass.save();
    res.status(201).json({ message: "Class created successfully", class: newClass });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// 2. Get All Classes (Modified to show Teacher Name)
const getClasses = async (req, res) => {
  try {
    // ✅ POPULATE ADDED: Isse Teacher aur Subject ka poora data milega
    const classes = await Class.find()
      .populate('classTeacher', 'fullName email phone')
      .populate('subjects.subject', 'name')
      .populate('subjects.teacher', 'fullName email phone')
      .sort({ grade: 1, section: 1 }); // Sort by Grade

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// 3. Update Fee Structure
const updateFeeStructure = async (req, res) => {
  try {
    const { classId, monthlyFee, yearlyFee, description } = req.body;

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      {
        feeStructure: {
          monthlyFee: Number(monthlyFee),
          yearlyFee: Number(yearlyFee),
          description
        }
      },
      { new: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json({ message: "Fee structure updated!", data: updatedClass });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// 4. ✅ NEW: Assign Class Teacher
const assignClassTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;
    const cleanTeacherId = (teacherId && String(teacherId).trim() !== "") ? teacherId : null;

    // Class dhoondo aur Teacher update karo
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { classTeacher: cleanTeacherId },
      { new: true } // Return updated data
    ).populate('classTeacher', 'fullName email phone')
     .populate('subjects.subject', 'name')
     .populate('subjects.teacher', 'fullName email phone');

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json({ message: "Teacher Assigned Successfully", data: updatedClass });

  } catch (error) {
    console.error("Assign Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ EXPORT ALL 4 FUNCTIONS
module.exports = {
  addClass,
  getClasses,
  updateFeeStructure,
  assignClassTeacher // <-- Ye zaroori hai routes ke liye
};