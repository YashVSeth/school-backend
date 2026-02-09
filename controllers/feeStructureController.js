const FeeStructure = require('../models/FeeStructure');

// ----------------------------------------------------------------
// 1. UPSERT (Create or Update)
// ----------------------------------------------------------------
const upsertStructure = async (req, res) => {
    try {
        // Frontend sends: { classId, breakdown: { monthlyTuition, ... } }
        const { classId, academicYear, breakdown } = req.body;

        // Validation
        if (!breakdown) {
            return res.status(400).json({ message: "Fee breakdown is required" });
        }

        // Map Frontend "breakdown" object -> Schema "Flat" fields
        const feeData = {
            classId: classId,
            academicYear: academicYear || "2026-27",
            monthlyTuition: Number(breakdown.monthlyTuition) || 0,
            admissionFee: Number(breakdown.admissionFee) || 0,
            examFee: Number(breakdown.examFee) || 0,
            // Add transport or development fee if your frontend supports it later
            developmentFee: 0, 
            transportMonthly: 0
        };

        // Use findOneAndUpdate with upsert
        const structure = await FeeStructure.findOneAndUpdate(
            { classId: classId }, // Query by classId
            feeData,              // Update with flat data
            { new: true, upsert: true } // Create if not exists
        );

        res.status(200).json(structure);

    } catch (error) {
        console.error("Upsert Error:", error);
        res.status(500).json({ message: "Failed to save fee structure", error: error.message });
    }
};

// ----------------------------------------------------------------
// 2. GET Structure by Class ID
// ----------------------------------------------------------------
const getStructureByClass = async (req, res) => {
    try {
        const { classId } = req.params;

        // Validate ID format to prevent crashes
        if (!classId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: "Invalid Class ID" });
        }

        const structure = await FeeStructure.findOne({ classId: classId });

        if (!structure) {
            // Return default format matching Frontend expectations
            return res.json({
                breakdown: {
                    monthlyTuition: 0,
                    admissionFee: 0,
                    examFee: 0
                },
                totalAmount: 0
            });
        }

        // Transform Flat Schema back to Nested format for Frontend
        // (So we don't have to change the React code)
        const yearlyTotal = (structure.monthlyTuition * 12) + structure.admissionFee + structure.examFee;

        res.json({
            breakdown: {
                monthlyTuition: structure.monthlyTuition,
                admissionFee: structure.admissionFee,
                examFee: structure.examFee
            },
            totalAmount: yearlyTotal
        });

    } catch (error) {
        console.error("Get Structure Error:", error);
        res.status(500).json({ message: "Error fetching structure" });
    }
};

// ----------------------------------------------------------------
// 3. APPLY TO CLASS (Placeholder)
// ----------------------------------------------------------------
const applyToClass = async (req, res) => {
    res.status(200).json({ message: "Applied to class" });
};

module.exports = {
    upsertStructure,
    getStructureByClass,
    applyToClass
};