
const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const SupplierPayment = require("../models/SupplierPayment");

const {
  recordSupplierRepayment,
} = require("../services/supplierPaymentService");

const {
  repaymentSchema,
  debtQuerySchema,
} = require("../validators/supplierPaymentValidators");

const {
  canManageBranch,
  canAccessBranch,
} = require("../middlewares/authorize");

const invalidId = (id) =>
  !mongoose.isValidObjectId(id);

// POST /api/purchases/:id/payments
const createRepayment = async (req, res, next) => {
  try {
    if (invalidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const parsed = repaymentSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid repayment details",
        errors: parsed.error.issues,
      });
    }

    // Check branch permission before modifying anything.
    const purchase = await Purchase.findById(
      req.params.id
    ).select("branch");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (
      !canManageBranch(
        req.user,
        purchase.branch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    const result = await recordSupplierRepayment({
      purchaseId: purchase._id,
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Supplier repayment recorded",
      payment: result.payment,
      purchase: {
        id: result.purchase._id,
        totalCost: result.purchase.totalCost,
        amountPaid: result.purchase.amountPaid,
        balanceDue: result.purchase.balanceDue,
        paymentStatus: result.purchase.paymentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/purchases/:id/payments
const getPurchasePayments = async (req, res, next) => {
  try {
    if (invalidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase ID",
      });
    }

    const purchase = await Purchase.findById(
      req.params.id
    ).select("branch");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (
      !canAccessBranch(
        req.user,
        purchase.branch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Branch access denied",
      });
    }

    const payments = await SupplierPayment.find({
      purchase: purchase._id,
    })
      .populate("recordedBy", "fullName role")
      .sort({ paidAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/purchases/debts
const getSupplierDebts = async (req, res, next) => {
  try {
    const parsed = debtQuerySchema.safeParse(
      req.query
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid debt report filters",
        errors: parsed.error.issues,
      });
    }

    const {
      branchId,
      supplierId,
      status,
      page,
      limit,
    } = parsed.data;

    const filter = {};

    // Non-admin users are restricted to their branch.
    if (req.user.role === "assistant") {
      if (
        branchId &&
        !canAccessBranch(req.user, branchId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Branch access denied",
        });
      }

      filter.branch = req.user.branch;
    } else if (branchId) {
      filter.branch = branchId;
    }

    if (supplierId) {
      filter.supplier = supplierId;
    }

    // By default, show outstanding debts only.
    if (status) {
      filter.paymentStatus = status;
    } else {
      filter.balanceDue = { $gt: 0 };
    }

    const skip = (page - 1) * limit;

    const [purchases, total, totals] =
      await Promise.all([
        Purchase.find(filter)
          .populate("supplier", "name phone")
          .populate("branch", "name code")
          .sort({ purchasedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Purchase.countDocuments(filter),

        Purchase.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalPurchaseValue: {
                $sum: "$totalCost",
              },
              totalPaid: {
                $sum: "$amountPaid",
              },
              totalOutstanding: {
                $sum: "$balanceDue",
              },
            },
          },
        ]),
      ]);

    const summary = totals[0] || {
      totalPurchaseValue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };

    return res.json({
      success: true,
      summary: {
        totalPurchaseValue:
          summary.totalPurchaseValue,
        totalPaid: summary.totalPaid,
        totalOutstanding:
          summary.totalOutstanding,
      },
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
  createRepayment,
  getPurchasePayments,
  getSupplierDebts,
};
