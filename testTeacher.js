const mongoose = require("mongoose");
const Teacher = require("./models/Teacher");
require("dotenv").config();

async function fixIndex() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school_erp_new");
        console.log("Connected to DB.");

        console.log("Dropping legacy 'username' index...");
        await Teacher.collection.dropIndex("username_1");
        console.log("✅ Index cleanly dropped!");

    } catch (err) {
        console.error("❌ Error dropping index:", err.message);
    } finally {
        mongoose.connection.close();
    }
}

fixIndex();
