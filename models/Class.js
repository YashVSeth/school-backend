const mongoose = require("mongoose");

const ClassSchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
  },
  section: {
    type: String,
    required: true,
  },
  // We will link students and teachers later
}, { timestamps: true });

module.exports = mongoose.model("Class", ClassSchema);