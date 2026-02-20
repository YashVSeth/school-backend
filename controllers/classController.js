const Class = require("../models/Class");

// 1. Add New Class
const addClass = async (req, res) => {
  try {
    const { grade, section, monthlyFee, yearlyFee } = req.body;

    // Check Duplicate
    const existingClass = await Class.findOne({ grade, section });
    if (existingClass) {
      return res.status(400).json({ message: "Class already exists" });
    }

    const newClass = new Class({ 
        grade, 
        section,
        feeStructure: { 
            monthlyFee: Number(monthlyFee) || 0, 
            yearlyFee: Number(yearlyFee) || 0 
        }
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
    // ✅ POPULATE ADDED: Isse Teacher ka poora data milega (Naam, Email)
    const classes = await Class.find()
        .populate('classTeacher', 'fullName email') 
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

        // Class dhoondo aur Teacher update karo
        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { classTeacher: teacherId },
            { new: true } // Return updated data
        ).populate('classTeacher', 'fullName');

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