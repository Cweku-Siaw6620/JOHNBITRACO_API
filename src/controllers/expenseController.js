
const mongoose = require("mongoose");

const Expense = require("../models/Expense");
const Branch = require("../models/Branch");

const {
  createExpenseSchema,
  reverseExpenseSchema,
  expenseQuerySchema,
} = require("../validators/expenseValidators");

const {
  canManageBranch,
  canAccessBranch,
} = require("../middlewares/authorize");

const errorResponse = (res, error) =>
  res.status(400).json({
    success: false,
    message: "Invalid expense information",
    errors: error.issues,
  });

const dateUTC = (day) =>
  new Date(`${day}T00:00:00.000Z`);

const nextDayUTC = (day) => {
  const date = dateUTC(day);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const createExpense = async (req, res, next) => {
  try {
    const parsed = createExpenseSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return errorResponse(res, parsed.error);
    }

    const data = parsed.data;

    if (!canManageBranch(req.user, data.branchId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    const branch = await Branch.findById(
      data.branchId
    );

    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: "Branch unavailable",
      });
    }

    const existing = await Expense.findOne({
      requestKey: data.requestKey,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Expense request already recorded",
      });
    }

    const expense = await Expense.create({
      branch: data.branchId,
      category: data.category,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference || "",
      expenseDate: dateUTC(data.expenseDate),
      requestKey: data.requestKey,
      recordedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      expense,
    });
  } catch (error) {
    next(error);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const parsed = expenseQuerySchema.safeParse(
      req.query
    );

    if (!parsed.success) {
      return errorResponse(res, parsed.error);
    }

    const {
      branchId,
      category,
      status,
      startDate,
      endDate,
      page,
      limit,
    } = parsed.data;

    const filter = {};

    if (req.user.role === "admin") {
      if (branchId) {
        filter.branch = new mongoose.Types.ObjectId(
          branchId
        );
      }
    } else {
      if (
        branchId &&
        !canAccessBranch(req.user, branchId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Branch access denied",
        });
      }

      filter.branch = new mongoose.Types.ObjectId(
        req.user.branch._id || req.user.branch
      );
    }

    if (category) {
      filter.category = category;
    }

    if (status !== "all") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.expenseDate = {};

      if (startDate) {
        filter.expenseDate.$gte = dateUTC(startDate);
      }

      if (endDate) {
        filter.expenseDate.$lt = nextDayUTC(endDate);
      }
    }

    const [expenses, total, summary] =
      await Promise.all([
        Expense.find(filter)
          .populate("branch", "name code")
          .populate("recordedBy", "fullName role")
          .sort({
            expenseDate: -1,
            createdAt: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        Expense.countDocuments(filter),

        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary,
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

const reverseExpense = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const parsed = reverseExpenseSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return errorResponse(res, parsed.error);
    }

    const expense = await Expense.findById(
      req.params.id
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (!canManageBranch(req.user, expense.branch)) {
      return res.status(403).json({
        success: false,
        message: "Branch access denied",
      });
    }

    const updated = await Expense.findOneAndUpdate(
      {
        _id: expense._id,
        status: "posted",
      },
      {
        $set: {
          status: "reversed",
          reversalReason: parsed.data.reason,
          reversedAt: new Date(),
          reversedBy: req.user._id,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "Expense has already been reversed",
      });
    }

    return res.json({
      success: true,
      message: "Expense reversed successfully",
      expense: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  reverseExpense,
};
