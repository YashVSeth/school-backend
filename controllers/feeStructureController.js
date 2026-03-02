const FeeStructure = require('../models/FeeStructure');

// @desc    Get fee structure for a specific class and academic year
// @route   GET /api/fee-structure/:classId
// @access  Private/Admin
const getFeeStructureByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const academicYear = req.query.academicYear || '2026-27'; // Default to current

        let feeStructure = await FeeStructure.findOne({ classId, academicYear });

        if (!feeStructure) {
            // Return empty structure instead of 404 to allow creating a new one from the UI easily
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

        let feeStructure = await FeeStructure.findOne({ classId, academicYear });

        if (feeStructure) {
            // Update existing
            feeStructure.mandatoryFees = mandatoryFees || [];
            feeStructure.optionalFees = optionalFees || [];
            feeStructure.lastUpdatedBy = req.user._id;
            await feeStructure.save();
        } else {
            // Create new
            feeStructure = await FeeStructure.create({
                classId,
                academicYear,
                mandatoryFees: mandatoryFees || [],
                optionalFees: optionalFees || [],
                lastUpdatedBy: req.user._id
            });
        }

        res.status(200).json({ message: 'Fee structure saved successfully', feeStructure });
    } catch (error) {
        console.error('Error saving fee structure:', error);
        res.status(500).json({ message: 'Server error saving fee structure' });
    }
};


module.exports = {
    getFeeStructureByClass,
    saveFeeStructure
};