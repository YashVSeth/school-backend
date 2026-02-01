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

module.exports = { addClass, getClasses };