const FeeStructure = require('../models/FeeStructure');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');

// Helper to normalize frequency strings
const normalizeFrequency = (freq) => {
    if (!freq) return 'MONTHLY';
    const up = freq.toString().toUpperCase().trim();
    if (up === 'MONTHLY' || up === 'QUARTERLY' || up === 'HALF-YEARLY' || up === 'YEARLY' || up === 'ONE-TIME') {
        return up;
    }
    if (up === 'ONE-TIME' || up === 'ONETIME' || up === 'ONE_TIME' || up === 'ONE TIME') return 'ONE-TIME';
    if (up === 'HALF YEARLY' || up === 'HALFYEARLY' || up === 'HALF_YEARLY') return 'HALF-YEARLY';
    return 'MONTHLY';
};

// Helper to clean fee items array
const cleanFeeItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items
        .filter(item => item && item.name && item.name.trim() !== '')
        .map(item => ({
            name: item.name.trim(),
            desc: item.desc || '',
            frequency: normalizeFrequency(item.frequency),
            amount: Math.max(0, Number(item.amount) || 0)
        }));
};

// Natural grade order comparator
const gradeOrder = (grade) => {
    if (!grade) return 999;
    const g = grade.toString().toLowerCase().trim();
    if (g.includes('play') || g.includes('pg')) return 1;
    if (g.includes('nur')) return 2;
    if (g.includes('lkg')) return 3;
    if (g.includes('ukg') || g.includes('kg')) return 4;
    const match = g.match(/\d+/);
    if (match) return 10 + parseInt(match[0], 10);
    const romanMap = { i: 11, ii: 12, iii: 13, iv: 14, v: 15, vi: 16, vii: 17, viii: 18, ix: 19, x: 20, xi: 21, xii: 22 };
    const rMatch = g.replace(/class/g, '').trim();
    if (romanMap[rMatch]) return romanMap[rMatch];
    return 100;
};

// @desc    Get all fee structures for an academic year (Single Batch Query)
// @route   GET /api/fee-structure/all
// @access  Private/Admin
const getAllFeeStructures = async (req, res) => {
    try {
        const academicYear = req.query.academicYear || '2026-27';

        const [structures, rawClasses] = await Promise.all([
            FeeStructure.find({ academicYear }).populate('classId', 'grade section').lean(),
            Class.find({}).select('grade section').lean()
        ]);

        const classes = [...rawClasses].sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade));

        const structureMap = {};
        structures.forEach(fs => {
            if (fs.classId) {
                const cId = fs.classId._id ? fs.classId._id.toString() : fs.classId.toString();
                structureMap[cId] = fs;
            }
        });

        res.status(200).json({
            academicYear,
            classes,
            structures: structureMap
        });
    } catch (error) {
        console.error('Error fetching all fee structures:', error);
        res.status(500).json({ message: 'Failed to fetch fee structures' });
    }
};

// @desc    Get fee structure for a specific class and academic year
// @route   GET /api/fee-structure/:classId
// @access  Private/Admin
const getFeeStructureByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const academicYear = req.query.academicYear || '2026-27';

        let feeStructure = await FeeStructure.findOne({ classId, academicYear }).populate('classId', 'grade section');

        if (!feeStructure) {
            return res.status(200).json({
                classId,
                academicYear,
                mandatoryFees: [],
                optionalFees: []
            });
        }

        res.status(200).json(feeStructure);
    } catch (error) {
        console.error('Error fetching fee structure:', error);
        res.status(500).json({ message: 'Server error fetching fee structure' });
    }
};

// @desc    Create or update fee structure for a class
// @route   POST /api/fee-structure/:classId
// @access  Private/Admin
const saveFeeStructure = async (req, res) => {
    try {
        const { classId } = req.params;
        const { mandatoryFees, optionalFees, academicYear = '2026-27' } = req.body;

        const cleanedMandatory = cleanFeeItems(mandatoryFees);
        const cleanedOptional = cleanFeeItems(optionalFees);

        const userId = req.user ? req.user._id : undefined;

        let feeStructure = await FeeStructure.findOne({ classId, academicYear });

        if (feeStructure) {
            feeStructure.mandatoryFees = cleanedMandatory;
            feeStructure.optionalFees = cleanedOptional;
            if (userId) feeStructure.lastUpdatedBy = userId;
            await feeStructure.save();
        } else {
            feeStructure = await FeeStructure.create({
                classId,
                academicYear,
                mandatoryFees: cleanedMandatory,
                optionalFees: cleanedOptional,
                lastUpdatedBy: userId
            });
        }

        res.status(200).json({
            message: 'Fee structure saved successfully',
            feeStructure
        });
    } catch (error) {
        console.error('Error saving fee structure:', error);
        res.status(500).json({ message: 'Server error saving fee structure' });
    }
};

// @desc    Copy fee structure from one class to target classes
// @route   POST /api/fee-structure/copy
// @access  Private/Admin
const copyFeeStructure = async (req, res) => {
    try {
        const { sourceClassId, targetClassIds, academicYear = '2026-27' } = req.body;

        if (!sourceClassId || !targetClassIds || !Array.isArray(targetClassIds) || targetClassIds.length === 0) {
            return res.status(400).json({ message: 'Source class and at least one target class are required' });
        }

        const source = await FeeStructure.findOne({ classId: sourceClassId, academicYear });
        if (!source) {
            return res.status(404).json({ message: 'Source fee structure not found' });
        }

        const userId = req.user ? req.user._id : undefined;
        let updatedCount = 0;

        for (const targetId of targetClassIds) {
            if (targetId === sourceClassId) continue;

            const clonedMandatory = source.mandatoryFees.map(f => ({
                name: f.name,
                desc: f.desc,
                frequency: f.frequency,
                amount: f.amount
            }));

            const clonedOptional = source.optionalFees.map(f => ({
                name: f.name,
                desc: f.desc,
                frequency: f.frequency,
                amount: f.amount
            }));

            await FeeStructure.findOneAndUpdate(
                { classId: targetId, academicYear },
                {
                    classId: targetId,
                    academicYear,
                    mandatoryFees: clonedMandatory,
                    optionalFees: clonedOptional,
                    lastUpdatedBy: userId
                },
                { upsert: true, new: true }
            );
            updatedCount++;
        }

        res.status(200).json({
            message: `Fee structure successfully copied to ${updatedCount} classes!`,
            copiedCount: updatedCount
        });
    } catch (error) {
        console.error('Error copying fee structure:', error);
        res.status(500).json({ message: 'Failed to copy fee structure' });
    }
};

// @desc    Apply fee structure to all students in a class
// @route   POST /api/fee-structure/apply/:classId
// @access  Private/Admin
const applyFeeStructureToClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const academicYear = req.body?.academicYear || '2026-27';

        const [structure, students] = await Promise.all([
            FeeStructure.findOne({ classId, academicYear }),
            Student.find({ class: classId, status: 'active' })
        ]);

        if (!structure) {
            return res.status(404).json({ message: 'No fee structure found for this class and academic year.' });
        }

        let invoicesCreated = 0;
        let studentsUpdated = 0;

        for (const student of students) {
            // Generate invoices for mandatory fee items if not already generated
            for (const item of (structure.mandatoryFees || [])) {
                if (item.amount <= 0) continue;

                const existingInvoice = await Invoice.findOne({
                    student: student._id,
                    title: item.name,
                    academicYear
                });

                if (!existingInvoice) {
                    await Invoice.create({
                        student: student._id,
                        title: item.name,
                        amount: item.amount,
                        dueDate: new Date(),
                        academicYear,
                        status: 'Unpaid'
                    });
                    invoicesCreated++;
                }
            }

            // Sync tuition fee in student's feeDetails if tuition exists
            const tuitionItem = (structure.mandatoryFees || []).find(f => f.name.toLowerCase().includes('tuition'));
            if (tuitionItem && student.feeDetails) {
                student.feeDetails.tuitionFee_2026 = tuitionItem.amount;
                student.markModified('feeDetails');
                await student.save();
                studentsUpdated++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Fee structure deployed to ${students.length} students! Generated ${invoicesCreated} invoices.`,
            studentsCount: students.length,
            invoicesCreated,
            studentsUpdated
        });
    } catch (error) {
        console.error('Error applying fee structure:', error);
        res.status(500).json({ message: 'Server error applying fee structure to students' });
    }
};

module.exports = {
    getAllFeeStructures,
    getFeeStructureByClass,
    saveFeeStructure,
    copyFeeStructure,
    applyFeeStructureToClass
};