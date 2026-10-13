
const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const CustomerPayment = require(
  "../models/CustomerPayment"
);

const {
  createSale,
} = require("../services/saleService");

const {
  recordCustomerPayment,
} = require("../services/customerPaymentService");

const {
  createSaleSchema,
  repaymentSchema,
} = require("../validators/saleValidators");

const {
  canManageBranch,
  canAccessBranch,
} = require("../middlewares/authorize");

const create = async (req, res, next) => {
  try {
    const parsed = createSaleSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale information",
        errors: parsed.error.issues,
      });
    }

    if (!canManageBranch(
      req.user,
      parsed.data.branchId
    )) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    // Only Admin may apply discounts for now.
    if (
      req.user.role !== "admin" &&
      parsed.data.discount > 0
    ) {
      return res.status(403).json({
        success: false,
        message: "Only Admin may apply discounts",
      });
    }

    const sale = await createSale({
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      sale,
    });
  } catch (error) {
    next(error);
  }
};

const getSales = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

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

      if (
        req.query.branchId &&
        !canAccessBranch(
          req.user,
          req.query.branchId
        )
      ) {
        return res.status(403).json({
          success: false,
          message: "Branch access denied",
        });
      }
    } else if (req.query.branchId) {
      if (!mongoose.isValidObjectId(req.query.branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      filter.branch = req.query.branchId;
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("branch", "name code")
        .populate("customer", "name phone")
        .sort({ soldAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Sale.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sales,
    });
  } catch (error) {
    next(error);
  }
};

const getDebts = async (req, res, next) => {
  try {
    const filter = {
      balanceDue: { $gt: 0 },
    };

    if (req.user.role === "assistant") {
      filter.branch = req.user.branch;

      if (
        req.query.branchId &&
        !canAccessBranch(
          req.user,
          req.query.branchId
        )
      ) {
        return res.status(403).json({
          success: false,
          message: "Branch access denied",
        });
      }
    } else if (req.query.branchId) {
      if (!mongoose.isValidObjectId(req.query.branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      filter.branch = req.query.branchId;
    }

    const totals = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDebt: { $sum: "$balanceDue" },
          numberOfSales: { $sum: 1 },
        },
      },
    ]);

    const debts = await Sale.find(filter)
      .populate("customer", "name phone")
      .populate("branch", "name code")
      .sort({ soldAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      summary: totals[0] || {
        totalDebt: 0,
        numberOfSales: 0,
      },
      debts,
    });
  } catch (error) {
    next(error);
  }
};

const getSalePayments = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const sale = await Sale.findById(
      req.params.id
    ).select("branch");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (!canAccessBranch(
      req.user,
      sale.branch
    )) {
      return res.status(403).json({
        success: false,
        message: "Branch access denied",
      });
    }

    const payments = await CustomerPayment.find({
      sale: sale._id,
    })
      .sort({ paidAt: -1 })
      .lean();

    return res.json({
      success: true,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

const addPayment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID",
      });
    }

    const parsed = repaymentSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment details",
        errors: parsed.error.issues,
      });
    }

    const sale = await Sale.findById(
      req.params.id
    ).select("branch");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (!canManageBranch(
      req.user,
      sale.branch
    )) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    const result = await recordCustomerPayment({
      saleId: sale._id,
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Customer payment recorded",
      payment: result.payment,
      balanceDue: result.sale.balanceDue,
      paymentStatus: result.sale.paymentStatus,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getSales,
  getDebts,
  getSalePayments,
  addPayment,
};
