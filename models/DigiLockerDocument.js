const mongoose = require('mongoose');

const DigiLockerDocumentSchema = new mongoose.Schema({
    // Target Owner: Student or Teacher
    ownerType: {
        type: String,
        enum: ['Student', 'Teacher'],
        required: true,
        index: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        default: null
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        default: null
    },

    // Denormalized search helpers for instant indexing & queries
    ownerName: { type: String, required: true, trim: true, index: true },
    ownerIdentifier: { type: String, trim: true, index: true }, // Student ID / Teacher Email / Phone
    classOrDept: { type: String, trim: true }, // e.g. "Class 1" or "Dept. of Science"

    // Document Information
    documentType: {
        type: String,
        required: true,
        trim: true,
        index: true
        // Examples: "Aadhaar Card", "Transfer Certificate (TC)", "Birth Certificate", "Marksheet",
        // "Character Certificate", "Caste Certificate", "Degree Certificate", "B.Ed Certificate",
        // "Resume / CV", "ID Proof", "Experience Letter", "Other"
    },
    documentNumber: { type: String, trim: true }, // e.g. "XXXX-XXXX-4829", "TC-2026/09"
    issuedBy: { type: String, default: "School Authority" }, // e.g. "UIDAI (Govt of India)", "CBSE Board", "State Govt"
    issueDate: { type: Date, default: null },

    // File Details
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: "document" },
    fileType: { type: String, default: "application/pdf" }, // e.g. "application/pdf", "image/jpeg"
    fileSize: { type: String, default: "1.0 MB" },

    // Verification & DigiLocker Digital India Status
    digilockerVerified: { type: Boolean, default: true },
    digilockerUri: { type: String, default: "" }, // Official URI format: "in.gov.uidai:adhr:..."
    verificationStatus: {
        type: String,
        enum: ['Verified', 'Pending Verification', 'Rejected'],
        default: 'Verified',
        index: true
    },
    verifiedBy: { type: String, default: 'School Administrator' },
    verifiedAt: { type: Date, default: Date.now },
    rejectionReason: { type: String, default: "" },

    // Remarks & Notes
    remarks: { type: String, default: "" },
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

DigiLockerDocumentSchema.index({ ownerName: 'text', documentType: 'text', documentNumber: 'text', ownerIdentifier: 'text' });

module.exports = mongoose.model('DigiLockerDocument', DigiLockerDocumentSchema);
