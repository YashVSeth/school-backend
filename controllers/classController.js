const Class = require("../models/Class");

const addClass = async (req, res) => {
  try {
    const { grade, section } = req.body;
    const existingClass = await Class.findOne({ grade, section });
    if (existingClass) {
      return res.status(400).json({ message: "Class already exists" });
    }
    const newClass = new Class({ grade, section });
    await newClass.save();
    res.status(201).json({ message: "Class created successfully", class: newClass });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

const getClasses = async (req, res) => {
  try {
    const classes = await Class.find();
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const { classId, monthlyFee, yearlyFee, description } = req.body;

    // Find the class and update specific fields
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      {
        feeStructure: {
          monthlyFee: Number(monthlyFee),
          yearlyFee: Number(yearlyFee),
          description
        }
      },
      { new: true } // Return the updated document
    );

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json({ message: "Fee structure updated!", data: updatedClass });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ CORRECT EXPORT (All in one object)
module.exports = { 
    addClass, 
    getClasses, 
    updateFeeStructure 
};