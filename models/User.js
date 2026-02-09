const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "teacher", "student"], // Admin aur Teacher hamare main focus hain
    default: "admin",
  },
  // Teacher Portal Integration: 
  // Agar role 'teacher' hai, toh ye field uske profile se connect hogi
  teacherProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },
  // Account Status (Security ke liye)
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Password Encrypt karne ka logic (Aapka existing logic preserved)
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next(); 
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password compare karne ka method (Aapka existing logic preserved)
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);