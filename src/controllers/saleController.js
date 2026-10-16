
const mongoose = require("mongoose");

const { salesQuerySchema, debtQuerySchema } = require("../validators/saleQueryValidators");

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

// MongoDB stores dates in UTC. Reporting dates use Ghana's UTC day boundaries.
function createDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const range = {};

  if (startDate) {
    range.$gte = new Date(`${startDate}T00:00:00.000Z`);
  }

  if (endDate) {
    const exclusiveEnd = new Date(`${endDate}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.$lt = exclusiveEnd;
  }

  return range;
}

function resolveBranchFilter(req, branchId) {
  const userBranch = req.user.branch?._id || req.user.branch;

  if (req.user.role === "assistant") {
    if (
      branchId &&
      String(branchId).toLowerCase() !== String(userBranch).toLowerCase()
    ) {
      const error = new Error("Branch access denied");
      error.status = 403;
      throw error;
    }

    if (!userBranch) {
      const error = new Error("Assigned branch is missing");
      error.status = 403;
      throw error;
    }

    return new mongoose.Types.ObjectId(String(userBranch));
  }

  return branchId
    ? new mongoose.Types.ObjectId(branchId)
    : undefined;
}

function respondQueryError(res, parsed) {
  return res.status(400).json({
    success: false,
    message: "Invalid query parameters",
    errors: parsed.error.issues,
  });
}

function handleKnownError(error, res, next) {
  if (error.status === 403) {
    return res.status(403).json({ success: false, message: error.message });
  }

  next(error);
}

function buildSalesFilter(req, query) {
  const filter = {};
  const branch = resolveBranchFilter(req, query.branchId);

  if (branch) filter.branch = branch;

  const soldAt = createDateRange(query.startDate, query.endDate);
  if (soldAt) filter.soldAt = soldAt;

  return filter;
}

// GET /api/sales — date-filtered and paginated transaction history.
const getSales = async (req, res, next) => {
  const parsed = salesQuerySchema.safeParse(req.query);
  if (!parsed.success) return respondQueryError(res, parsed);

  try {
    const { page, limit } = parsed.data;
    const filter = buildSalesFilter(req, parsed.data);

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate("branch", "name code")
        .populate("customer", "name phone")
        .sort({ soldAt: -1, _id: -1 })
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
    return handleKnownError(error, res, next);
  }
};

// GET /api/sales/summary — totals across ALL matching sales, not one page.
// Payments received are cumulative against these sales, not cash collected
// specifically on the selected day. Separate payment-date reporting is needed
// for a daily cash-flow report.
const getSalesSummary = async (req, res, next) => {
  const parsed = salesQuerySchema.safeParse(req.query);
  if (!parsed.success) return respondQueryError(res, parsed);

  try {
    const filter = buildSalesFilter(req, parsed.data);

    const [result] = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          transactions: { $sum: 1 },
          revenue: { $sum: "$total" },
          amountPaid: { $sum: "$amountPaid" },
          balanceDue: { $sum: "$balanceDue" },
          itemsSold: {
            $sum: {
              $sum: {
                $map: {
                  input: "$items",
                  as: "item",
                  in: "$$item.quantity",
                },
              },
            },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      summary: {
        transactions: result?.transactions || 0,
        revenue: result?.revenue || 0,
        amountPaid: result?.amountPaid || 0,
        balanceDue: result?.balanceDue || 0,
        itemsSold: result?.itemsSold || 0,
      },
    });
  } catch (error) {
    return handleKnownError(error, res, next);
  }
};

// GET /api/sales/debts — accurate totals and database-backed pages.
const getDebts = async (req, res, next) => {
  const parsed = debtQuerySchema.safeParse(req.query);
  if (!parsed.success) return respondQueryError(res, parsed);

  try {
    const { page, limit } = parsed.data;
    const filter = {
      balanceDue: { $gt: 0 },
    };

    const branch = resolveBranchFilter(req, parsed.data.branchId);
    if (branch) filter.branch = branch;

    const [debts, total, aggregates] = await Promise.all([
      Sale.find(filter)
        .populate("customer", "name phone")
        .populate("branch", "name code")
        .sort({ soldAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
      Sale.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalDebt: { $sum: "$balanceDue" },
            numberOfSales: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalDebt: aggregates[0]?.totalDebt || 0,
        numberOfSales: aggregates[0]?.numberOfSales || 0,
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      debts,
    });
  } catch (error) {
    return handleKnownError(error, res, next);
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
  getSalesSummary,
  getDebts,
  getSalePayments,
  addPayment,
};
