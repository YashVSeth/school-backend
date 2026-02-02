const Teacher = require("../models/Teacher");

// Get all teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching teachers" });
  }
};

// Add a new teacher (Complex with Files)
exports.addTeacher = async (req, res) => {
  try {
    // 1. Extract text data from req.body
    const { 
      fullName, email, gender, dob, permanentAddress, aadhaarNumber, 
      bloodGroup, highestQualification, university, specialization, 
      remarks, extraDuties, username, password, role, status, phone 
    } = req.body;

    // 2. Check if email exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher with this email already exists" });
    }

    // 3. Extract File Paths (if files were uploaded)
    // req.files is created by Multer
    const photoUrl = req.files['photo'] ? req.files['photo'][0].path : null;
    const resumeUrl = req.files['resume'] ? req.files['resume'][0].path : null;
    const idProofUrl = req.files['idProof'] ? req.files['idProof'][0].path : null;

    // 4. Create new Teacher object
    const newTeacher = new Teacher({
      fullName, email, gender, dob, permanentAddress, aadhaarNumber,
      bloodGroup, highestQualification, university, specialization,
      remarks, extraDuties, username, password, role, status, phone,
      photoUrl, resumeUrl, idProofUrl // Save the paths
    });

    // ... existing getTeachers and addTeacher code ...

// 3. Update Teacher
exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle file updates separately (if new files are uploaded)
    if (req.files) {
      if (req.files['photo']) updates.photoUrl = req.files['photo'][0].path;
      if (req.files['resume']) updates.resumeUrl = req.files['resume'][0].path;
      if (req.files['idProof']) updates.idProofUrl = req.files['idProof'][0].path;
    }

    const updatedTeacher = await Teacher.findByIdAndUpdate(id, updates, { new: true });
    
    if (!updatedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ message: "Teacher updated successfully", teacher: updatedTeacher });
  } catch (error) {
    res.status(500).json({ message: "Error updating teacher", error: error.message });
  }
};

// 4. Delete Teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTeacher = await Teacher.findByIdAndDelete(id);

    if (!deletedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({ message: "Teacher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting teacher", error: error.message });
  }
};

    // 5. Save to Database
    await newTeacher.save();

    res.status(201).json({ message: "Teacher added successfully!", teacher: newTeacher });

  } catch (error) {
    console.error("Error adding teacher:", error);
    res.status(500).json({ message: "Server Error: Failed to add teacher", error: error.message });
  }
};