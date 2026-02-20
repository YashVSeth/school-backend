const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    // --- BASIC INFORMATION ---
    studentId: { type: String, required: true, unique: true }, 
    firstName: { type: String, required: true },               
    lastName: { type: String },                                
    fatherName: { type: String, required: true },
    motherName: { type: String }, 
    
    // --- PROFILE DETAILS ---
    dob: { type: Date },          
    email: { type: String },      
    phone: { type: String },      
    address: { type: String },    
    gender: { type: String },     
    bloodGroup: { type: String },
    height: { type: String },     
    weight: { type: String },

    // --- ACADEMIC ---
    class: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true 
    },
    rollNo: { type: Number }, 
    dateOfAdmission: { type: Date, default: Date.now },

    // --- MASTER PLAN: SETTINGS ---
    whatsappEnabled: { type: Boolean, default: true }, 

    // --- WATERFALL FINANCE ---
    feeDetails: {
        // ✅ NEW: Advance Wallet for leftover change
        walletBalance: { type: Number, default: 0 }, 
        
        // Backlogs (Arrears)
        backlog_2024: { type: Number, default: 0 },
        backlog_2025: { type: Number, default: 0 },
        
        // Current Session
        tuitionFee_2026: { type: Number, default: 0 },
        
        // Charges
        admissionFee: { type: Number, default: 0 },
        electricalCharges: { type: Number, default: 0 },
        maintenanceCharges: { type: Number, default: 0 },
        
        // Transport
        isUsingTransport: { type: Boolean, default: false },
        transportRoute: { type: String, default: "" },
        transportFee: { type: Number, default: 0 },

        // Transaction History (Legacy array)
        history: [{
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            months: [{ type: String }] 
        }],

        // Archive Shield
        legacy_2022: { type: Object, default: null }
    },

    performanceRemarks: {
        type: String, 
        default: "No remarks added yet." 
    },
    
    status: { 
        type: String, 
        enum: ['active', 'inactive'], 
        default: 'active' 
    }
}, { timestamps: true });

// Indexing for faster searches
StudentSchema.index({ firstName: 'text', lastName: 'text', studentId: 'text' });

module.exports = mongoose.model('Student', StudentSchema);