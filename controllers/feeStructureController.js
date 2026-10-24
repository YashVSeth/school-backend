const FeeStructure = require('../models/FeeStructure');
const Class = require('../models/Class');

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

// @desc    Get all fee structures for an academic year (Single Batch Query)
// @route   GET /api/fee-structure/all
// @access  Private/Admin
const getAllFeeStructures = async (req, res) => {
    try {
        const academicYear = req.query.academicYear || '2026-27';
        
        const [structures, classes] = await Promise.all([
            FeeStructure.find({ academicYear }).populate('classId', 'grade section').lean(),
            Class.find({}).select('grade section').sort({ grade: 1 }).lean()
        ]);

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

module.exports = {
    getAllFeeStructures,
    getFeeStructureByClass,
    saveFeeStructure,
    copyFeeStructure
};