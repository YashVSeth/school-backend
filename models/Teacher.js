const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    // Step 1: Basic Info
    photo: { type: String },
    fullName: { type: String, required: true },
    gender: { type: String },
    dob: { type: Date },
    // Email is primary identity
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    permanentAddress: { type: String },
    aadhaarNumber: { type: String },
    bloodGroup: { type: String },

    // Step 2: Qualifications & Payroll
    baseSalary: { type: Number, default: 0 },
    highestQualification: { type: String },
    university: { type: String },
    specialization: { type: String },
    experience: { type: String },
    remarks: { type: String },
    extraDuties: { type: String, default: 'No' },

    // Step 3: Credentials & Status
    resume: { type: String },
    idProof: { type: String },
    username: { type: String },

    // Security: exclude password from default queries
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'Teacher' },
    status: { type: String, default: 'Active' },

    createdAt: { type: Date, default: Date.now }
}, {
    toJSON: {
        transform(doc, ret) {
            delete ret.password;
            return ret;
        }
    },
    toObject: {
        transform(doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

const Teacher = mongoose.model('Teacher', TeacherSchema);

// Automatically drop the old legacy unique index for 'username' if it exists in the database
Teacher.collection.dropIndex('username_1').catch(err => {
    // Index might not exist, which is fine
});

module.exports = Teacher;