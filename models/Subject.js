const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Only Name is required now
  // code field removed
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);