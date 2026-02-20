const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Class = require('./models/Class');

dotenv.config();

// 👇 1. YAHAN APNA LOGIN WALA EMAIL LIKHEIN
const TEACHER_EMAIL = "subhash@school.com"; 

// 👇 2. Class ka naam
const GRADE = "Class 10";
const SECTION = "A";

const link = async () => {
    try {
        // DB Connection
        const db = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school_db";
        await mongoose.connect(db);
        console.log("✅ Database Connected");

        // Teacher Dhoondo
        const teacher = await User.findOne({ email: TEACHER_EMAIL });
        if (!teacher) {
            console.log(`❌ Error: Teacher with email '${TEACHER_EMAIL}' nahi mila!`);
            console.log("👉 Tip: Check karein ki aapne sahi spelling likhi hai.");
            process.exit();
        }
        console.log(`👨‍🏫 Teacher Found: ${teacher.name} (${teacher._id})`);

        // Class Dhoondo (Ya Nayi Banao)
        let cls = await Class.findOne({ grade: GRADE, section: SECTION });
        
        if (!cls) {
            console.log("⚠️ Class nahi mili, nayi bana raha hoon...");
            cls = new Class({ grade: GRADE, section: SECTION });
        }

        // 💪 ZABARDASTI LINK KAREIN (Har sambhav naam se)
        cls.teacher = teacher._id;        // Option 1
        cls.classTeacher = teacher._id;   // Option 2
        cls.teacherId = teacher._id;      // Option 3
        
        await cls.save();
        
        console.log("------------------------------------------------");
        console.log(`🎉 SUCCESS! '${teacher.name}' ab '${GRADE} - ${SECTION}' ke teacher hain.`);
        console.log("------------------------------------------------");
        console.log("👉 Ab Browser par jakar Dashboard Refresh karein.");
        
        process.exit();

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit();
    }
};

link();