const Schedule = require('../models/Schedule');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');

// Helper to determine the EXACT Teacher ID handling a slot right now
const getActiveTeacherForSlot = async (classId, subjectName) => {
    const sub = await Subject.findOne({ name: subjectName });
    if (!sub) return null;

    const cls = await Class.findById(classId);
    if (!cls || !cls.subjects) return null;

    const subjectRef = cls.subjects.find(s => s.subject.toString() === sub._id.toString());
    return subjectRef?.teacher ? subjectRef.teacher.toString() : null;
};

exports.getScheduleByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const schedule = await Schedule.find({ classId });
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch schedule" });
    }
};

exports.getScheduleByTeacher = async (req, res) => {
    try {
        const teacherId = req.params.teacherId;

        // 1. Find all classes where this teacher is assigned to ANY subject
        const classes = await Class.find({ "subjects.teacher": teacherId });

        // 2. Build a filter of (classId + subject) combinations they actually own
        const validBlocks = [];
        classes.forEach(cls => {
            const subjectsTaughtByThem = cls.subjects.filter(s => s.teacher?.toString() === teacherId.toString());
            subjectsTaughtByThem.forEach(taughtSubRef => {
                validBlocks.push({
                    classId: cls._id,
                    subjectId: taughtSubRef.subject // This gives the Subject DB _id
                });
            });
        });

        // Resolve subject names to match against Schedule logic (which stores subject names as strings currently)
        const allTargetSubjectIds = [...new Set(validBlocks.map(b => b.subjectId))];
        const resolvedSubjects = await Subject.find({ _id: { $in: allTargetSubjectIds } });

        const scheduleQueryOR = validBlocks.map(vb => {
            const subjectModel = resolvedSubjects.find(s => s._id.toString() === vb.subjectId.toString());
            return {
                classId: vb.classId,
                subject: subjectModel ? subjectModel.name : null
            };
        }).filter(q => q.subject !== null);

        if (scheduleQueryOR.length === 0) {
            return res.json([]); // Teacher teaches 0 recognized classes
        }

        // 3. Find all scheduled time blocks matching those exact Grade/Subject combos!
        const schedule = await Schedule.find({ $or: scheduleQueryOR })
            .populate('classId', 'grade section')
            .sort({ day: 1, timeSlot: 1 });

        res.json(schedule);
    } catch (error) {
        console.error("Get Schedule By Teacher Error:", error);
        res.status(500).json({ message: "Failed to fetch teacher schedule" });
    }
};

exports.addScheduleEntry = async (req, res) => {
    try {
        const { classId, day, timeSlot, subject } = req.body;

        // 1. Check for CLASS CONFLICT: Does this specific grade already have a class at this time?
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

        // 2. Check for TEACHER CONFLICT: Is the teacher for this new subject already booked?
        const targetTeacherId = await getActiveTeacherForSlot(classId, subject);

        if (targetTeacherId) {
            // Fetch ALL schedules happening at this exact day & time
            const concurrentSchedules = await Schedule.find({ day, timeSlot });

            for (let sim of concurrentSchedules) {
                const simTeacherId = await getActiveTeacherForSlot(sim.classId, sim.subject);

                if (simTeacherId === targetTeacherId) {
                    const tObj = await Teacher.findById(simTeacherId);
                    const tName = tObj ? (tObj.fullName || tObj.firstName || 'This teacher') : 'This teacher';
                    return res.status(400).json({
                        message: `💥 Teacher Clash! ${tName} is already scheduled to teach ${sim.subject} in another class at this time.`
                    });
                }
            }
        }

        // If no conflicts, save it!
        const newEntry = await Schedule.create(req.body);
        res.status(201).json(newEntry);
    } catch (error) {
        console.error("Add Schedule Error:", error);
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

exports.updateScheduleEntry = async (req, res) => {
    try {
        const scheduleEntryId = req.params.id;

        const updatedEntry = await Schedule.findByIdAndUpdate(
            scheduleEntryId,
            req.body,
            { new: true }
        );

        if (!updatedEntry) {
            return res.status(404).json({ message: "Schedule entry not found" });
        }

        res.json(updatedEntry);
    } catch (error) {
        console.error("Update Schedule Error:", error);
        res.status(500).json({ message: "Failed to update schedule entry" });
    }
};