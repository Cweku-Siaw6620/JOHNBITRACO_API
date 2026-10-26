const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const User = require("../models/User");

const getBranches = async (req, res, next) => {
  try {
    let branches;

    if (req.user.role === "admin") {
      branches = await Branch.find().sort({ name: 1 });
    } else {
      branches = await Branch.find({
        _id: req.user.branch,
        isActive: true,
      });
    }

    return res.json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    next(error);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const { name, code, location } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof code !== "string" ||
      !/^[A-Za-z0-9_-]{2,20}$/.test(code) ||
      (location !== undefined &&
        (typeof location !== "string" ||
          location.length > 200))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch information",
      });
    }

    const branch = await Branch.create({
      name: name.trim(),
      code: code.toUpperCase(),
      location: location?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    const allowedFields = [
      "name",
      "location",
      "isActive",
    ];

    const fields = Object.keys(req.body);

    if (
      fields.length === 0 ||
      fields.some((key) => !allowedFields.includes(key))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch update",
      });
    }

    const { name, location, isActive } = req.body;

    if (
      (name !== undefined &&
        (typeof name !== "string" ||
          !name.trim() ||
          name.length > 100)) ||
      (location !== undefined &&
        (typeof location !== "string" ||
          location.length > 200)) ||
      (isActive !== undefined &&
        typeof isActive !== "boolean")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch values",
      });
    }

    if (
      branch.code === "MAIN" &&
      isActive === false
    ) {
      return res.status(403).json({
        success: false,
        message: "Main Branch cannot be deactivated",
      });
    }

    if (isActive === false) {
      const assignedUsers = await User.countDocuments({
        branch: branch._id,
        isActive: true,
      });

      if (assignedUsers > 0) {
        return res.status(409).json({
          success: false,
          message: "Reassign or deactivate branch staff first",
        });
      }
    }

    if (name !== undefined) {
      branch.name = name.trim();
    }

    if (location !== undefined) {
      branch.location = location.trim();
    }

    if (isActive !== undefined) {
      branch.isActive = isActive;
    }

    await branch.save();

    return res.json({
      success: true,
      message: "Branch updated successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/branches/:id
// Permanently removes a non-MAIN branch and branch-owned records in one transaction.
const deleteBranch = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid branch ID",
    });
  }

  const BranchStock = require("../models/BranchStock");
  const StockMovement = require("../models/StockMovement");
  const Sale = require("../models/Sale");
  const CustomerPayment = require("../models/CustomerPayment");
  const Purchase = require("../models/Purchase");
  const SupplierPayment = require("../models/SupplierPayment");
  const Expense = require("../models/Expense");
  const Session = require("../models/Session");

  const dbSession = await mongoose.startSession();
  let outcome;

  try {
    await dbSession.withTransaction(async () => {
      const branch = await Branch.findById(req.params.id).session(dbSession);

      if (!branch) {
        const error = new Error("Branch not found");
        error.status = 404;
        throw error;
      }

      if (branch.code === "MAIN") {
        const error = new Error("Main Branch cannot be deleted");
        error.status = 403;
        throw error;
      }

      // Explicitly select branch-owned users and transactions.
      const [users, sales, purchases] = await Promise.all([
        User.find({ branch: branch._id }).select("_id").session(dbSession).lean(),
        Sale.find({ branch: branch._id }).select("_id").session(dbSession).lean(),
        Purchase.find({ branch: branch._id }).select("_id").session(dbSession).lean(),
      ]);

      const userIds = users.map((user) => user._id);
      const saleIds = sales.map((sale) => sale._id);
      const purchaseIds = purchases.map((purchase) => purchase._id);

      // Payments belonging to the branch or its transactions.
      // Shared customers and suppliers are deliberately retained.
      const customerPaymentFilter = {
        $or: [
          { branch: branch._id },
          { sale: { $in: saleIds } },
        ],
      };
      const supplierPaymentFilter = {
        $or: [
          { branch: branch._id },
          { purchase: { $in: purchaseIds } },
        ],
      };

      const counts = {};
      const remove = async (label, Model, filter) => {
        const result = await Model.deleteMany(filter).session(dbSession);
        counts[label] = result.deletedCount || 0;
      };

      // Sequential writes within the transaction avoid parallel-session issues.
      await remove("customerPayments", CustomerPayment, customerPaymentFilter);
      await remove("supplierPayments", SupplierPayment, supplierPaymentFilter);
      await remove("stockMovements", StockMovement, { branch: branch._id });
      await remove("branchStock", BranchStock, { branch: branch._id });
      await remove("sales", Sale, { branch: branch._id });
      await remove("purchases", Purchase, { branch: branch._id });
      await remove("expenses", Expense, { branch: branch._id });
      await remove("sessions", Session, { user: { $in: userIds } });
      await remove("users", User, { _id: { $in: userIds }, branch: branch._id });
      await remove("branches", Branch, { _id: branch._id, code: { $ne: "MAIN" } });

      if (counts.branches !== 1) {
        throw new Error("Branch deletion did not complete");
      }

      outcome = { branchId: branch._id, branchName: branch.name, deleted: counts };
    });

    return res.json({
      success: true,
      message: "Branch and associated branch-owned records permanently deleted",
      ...outcome,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    await dbSession.endSession();
  }
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
};