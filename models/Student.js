const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // Update Email: It is not required, but if provided, it must be unique.
  // We use `sparse: true` to allow multiple students to have NO email (null).
  email: { type: String, unique: true, sparse: true }, 

  rollNum: { type: Number, required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  
  dob: { type: Date },
  gender: { type: String, enum: ["Male", "Female", "Third Gender"] },
  nationality: { type: String },
  bloodGroup: { type: String },
  photo: { type: String },

  attendance: [
    {
      date: { type: Date, required: true },
      status: { type: String, enum: ["Present", "Absent"], required: true },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Student", studentSchema);