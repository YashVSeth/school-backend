const Mark = require('../models/Mark');
const Student = require('../models/Student');

// 1. Get Marks for a specific Class, Subject, and Exam Type
exports.getMarks = async (req, res) => {
    try {
        const { classId, subject, examType } = req.query;

        if (!classId || !subject || !examType) {
            return res.status(400).json({ message: "classId, subject, and examType are required parameters." });
        }

        const marks = await Mark.find({ classId, subject, examType })
            .populate('student', 'fullName rollNumber');

        res.status(200).json(marks);
    } catch (error) {
        console.error("Error fetching marks:", error);
        res.status(500).json({ message: "Failed to fetch marks" });
    }
};

// 2. Bulk Submit/Update Marks
exports.submitBulkMarks = async (req, res) => {
    try {
        const teacherId = req.user._id; // Extracted from authMiddleware
        const { classId, subject, examType, marksData } = req.body;
        // marksData format: [{ studentId: "...", score: 85, remarks: "Good" }, ...]

        if (!classId || !subject || !examType || !Array.isArray(marksData)) {
            return res.status(400).json({ message: "Invalid payload layout" });
        }

        const bulkOps = marksData.map(record => ({
            updateOne: {
                filter: {
                    student: record.studentId,
                    subject: subject,
                    examType: examType
                },
                update: {
                    $set: {
                        classId: classId,
                        score: record.score,
                        remarks: record.remarks || '',
                        teacher: teacherId
                    }
                },
                upsert: true // Creates the mark document if it doesn't already exist
            }
        }));

        await Mark.bulkWrite(bulkOps);

        res.status(200).json({ message: "Marks submitted successfully!" });
    } catch (error) {
        console.error("Error submitting marks:", error);
        res.status(500).json({ message: "Failed to submit marks" });
    }
};
