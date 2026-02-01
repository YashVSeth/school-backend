const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    // Step 1: Basic Info
    photo: { type: String },
    fullName: { type: String, required: true },
    gender: { type: String },
    dob: { type: Date },
    email: { type: String, required: true, unique: true },
    permanentAddress: { type: String },
    aadhaarNumber: { type: String },
    bloodGroup: { type: String },
    
    // Step 2: Qualifications
    highestQualification: { type: String },
    university: { type: String },
    specialization: { type: String },
    remarks: { type: String },
    extraDuties: { type: String, default: 'No' },

    // Step 3: Credentials & Status
    resume: { type: String },
    idProof: { type: String },
    username: { type: String, unique: true },
    password: { type: String }, // In a real app, hash this before saving!
    role: { type: String, default: 'Teacher' },
    status: { type: String, default: 'Active' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);