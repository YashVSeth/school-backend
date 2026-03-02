const Expense = require('../models/Expense');

// @desc    Add a new expense
// @route   POST /api/expenses
// @access  Private (Admin only)
exports.addExpense = async (req, res) => {
    try {
        const { category, description, quantity, unitPrice, date } = req.body;

        const parsedQty = parseFloat(quantity);
        const parsedPrice = parseFloat(unitPrice);

        if (isNaN(parsedQty) || isNaN(parsedPrice)) {
            return res.status(400).json({ success: false, message: 'Invalid quantity or unit price.' });
        }

        const total = parsedQty * parsedPrice;

        const expense = await Expense.create({
            category,
            description,
            quantity: parsedQty,
            unitPrice: parsedPrice,
            total,
            date: date ? new Date(date) : Date.now()
        });

        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        console.error("Add expense error:", error);
        res.status(500).json({ success: false, message: 'Server error adding expense' });
    }
};

// @desc    Get all expenses (with optional pagination/sorting)
// @route   GET /api/expenses
// @access  Private (Admin only)
exports.getExpenses = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        // Custom Month Filter Logic
        let filter = {};
        if (req.query.month) {
            const selectedMonth = parseInt(req.query.month, 10);
            const year = new Date().getFullYear();

            const startOfMonth = new Date(year, selectedMonth - 1, 1);
            const endOfMonth = new Date(year, selectedMonth, 0, 23, 59, 59, 999);

            filter.date = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const expenses = await Expense.find(filter)
            .sort({ date: -1, createdAt: -1 }) // Sort newest first
            .skip(skip)
            .limit(limit);

        const total = await Expense.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: expenses.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: expenses
        });
    } catch (error) {
        console.error("Get expenses error:", error);
        res.status(500).json({ success: false, message: 'Server error retrieving expenses' });
    }
};

// @desc    Get monthly expense statistics (aggregate totals)
// @route   GET /api/expenses/stats
// @access  Private (Admin only)
exports.getExpenseStats = async (req, res) => {
    try {
        // Custom Month Logic (Defaults to Current Month if not provided)
        let startOfMonth, endOfMonth;
        const year = new Date().getFullYear();

        if (req.query.month) {
            const selectedMonth = parseInt(req.query.month, 10);
            startOfMonth = new Date(year, selectedMonth - 1, 1);
            endOfMonth = new Date(year, selectedMonth, 0, 23, 59, 59, 999);
        } else {
            startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            endOfMonth = new Date();
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0);
            endOfMonth.setHours(23, 59, 59, 999);
        }

        // Aggregate overall monthly total
        const monthlyTotalAgg = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$total" }
                }
            }
        ]);

        // Aggregate category totals for the month
        const categoryTotalsAgg = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: "$category",
                    total: { $sum: "$total" }
                }
            }
        ]);

        const totalExpense = monthlyTotalAgg.length > 0 ? monthlyTotalAgg[0].total : 0;

        // Format category totals cleanly
        const categoryBreakdown = {};
        categoryTotalsAgg.forEach(cat => {
            categoryBreakdown[cat._id] = cat.total;
        });

        res.status(200).json({
            success: true,
            data: {
                totalMonthlyExpense: totalExpense,
                categoryBreakdown,
                month: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
            }
        });

    } catch (error) {
        console.error("Expense stats error:", error);
        res.status(500).json({ success: false, message: 'Server error calculating stats' });
    }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private (Admin only)
exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        await expense.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Delete expense error:", error);
        res.status(500).json({ success: false, message: 'Server error deleting expense' });
    }
};
