
const Purchase = require("../models/Purchase");

const {
  createPurchase,
} = require("../services/purchaseService");

const {
  createPurchaseSchema,
} = require("../validators/purchaseValidators");

const {
  canManageBranch,
} = require("../middlewares/authorize");

const create = async (req, res, next) => {
  try {
    const parsed = createPurchaseSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase information",
        errors: parsed.error.issues,
      });
    }

    if (
      !canManageBranch(
        req.user,
        parsed.data.branchId
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    const purchase = await createPurchase({
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase recorded successfully",
      purchase,
    });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination",
      });
    }

    const filter = {};

    if (req.user.role === "assistant") {
      filter.branch = req.user.branch;
    } else if (req.query.branchId) {
      const mongoose = require("mongoose");

      if (!mongoose.isValidObjectId(req.query.branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      filter.branch = req.query.branchId;
    }

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate("supplier", "name phone")
        .populate("branch", "name code")
        .sort({ purchasedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Purchase.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
};
