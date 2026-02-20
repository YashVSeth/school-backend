const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    // Step 1: Basic Info
    photo: { type: String },
    fullName: { type: String, required: true },
    gender: { type: String },
    dob: { type: Date },
    // ✅ Email hi ab primary identity hai
    email: { type: String, required: true, unique: true }, 
    phone: { type: String }, 
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
    
    // ⚠️ UPDATE: 'username' se 'unique: true' hata diya gaya hai 
    // taaki ye login mein rukawat na bane.
    username: { type: String }, 
    
    password: { type: String, required: true }, 
    role: { type: String, default: 'Teacher' },
    status: { type: String, default: 'Active' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);