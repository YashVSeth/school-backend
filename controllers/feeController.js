const Fee = require('../models/Fee');
const Student = require('../models/Student'); // Optional: to verify student exists

// 1. Add New Fee Payment
exports.addFee = async (req, res) => {
  try {
    const { studentId, amount, feeType, paymentMethod, status } = req.body;

    const newFee = new Fee({
      studentId,
      amount,
      feeType,
      paymentMethod,
      status
    });

    const savedFee = await newFee.save();
    
    // Populate student details immediately so frontend can display name
    await savedFee.populate('studentId', 'firstName lastName studentId');

    res.status(201).json(savedFee);
  } catch (error) {
    res.status(500).json({ message: "Error recording fee", error: error.message });
  }
};

// 2. Get All Fee Records (with Filters)
exports.getFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate('studentId', 'firstName lastName studentId class') // Get student info
      .sort({ createdAt: -1 }); // Newest first

    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching fees" });
  }
};

// 3. Get Dashboard Stats
exports.getFeeStats = async (req, res) => {
  try {
    // specific mongodb aggregation to sum up amounts
    const stats = await Fee.aggregate([
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(stats[0] || { totalCollected: 0, count: 0 });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
};

// 4. Get Fee History for ONE Student
exports.getStudentFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const fees = await Fee.find({ studentId }).sort({ date: -1 });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student fees" });
  }
};