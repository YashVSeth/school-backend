const Schedule = require('../models/Schedule');
const Class = require('../models/Class'); 

exports.getScheduleByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const schedule = await Schedule.find({ classId });
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch schedule" });
    }
};

exports.addScheduleEntry = async (req, res) => {
    try {
        const { classId, day, timeSlot, subject } = req.body;

        // ✅ ONLY CHECK FOR CLASS CONFLICT (Removed Teacher Check)
        // Does this specific grade already have a class at this time?
        const classConflict = await Schedule.findOne({
            classId: classId,
            day: day,
            timeSlot: timeSlot
        });

        if (classConflict) {
            return res.status(400).json({ 
                message: `This class already has ${classConflict.subject} scheduled on ${day} at ${timeSlot}.` 
            });
        }

        // If no conflicts, save it!
        const newEntry = await Schedule.create(req.body);
        res.status(201).json(newEntry);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add schedule entry" });
    }
};

exports.deleteScheduleEntry = async (req, res) => {
    try {
        await Schedule.findByIdAndDelete(req.params.id);
        res.json({ message: "Entry deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete entry" });
    }
};