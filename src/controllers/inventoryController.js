
const mongoose = require("mongoose");

const BranchStock = require("../models/BranchStock");
const StockMovement = require("../models/StockMovement");

const {
  addOpeningStock,
  adjustStock,
} = require("../services/stockService");

const {
  openingStockSchema,
  adjustmentSchema,
  inventoryQuerySchema,
} = require("../validators/inventoryValidators");

const {
  canAccessBranch,
  canManageBranch,
} = require("../middlewares/authorize");

const sendValidationError = (res, error) => {
  return res.status(400).json({
    success: false,
    message: "Invalid request information",
    errors: error.issues,
  });
};

// Register opening inventory.
const createOpeningStock = async (req, res, next) => {
  try {
    const parsed = openingStockSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return sendValidationError(
        res,
        parsed.error
      );
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only Admin can register opening stock",
      });
    }

    const result = await addOpeningStock({
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Opening stock recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Make an authorized physical stock correction.
const createAdjustment = async (req, res, next) => {
  try {
    const parsed = adjustmentSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      return sendValidationError(
        res,
        parsed.error
      );
    }

    const { branchId } = parsed.data;

    if (!canManageBranch(req.user, branchId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this branch",
      });
    }

    const result = await adjustStock({
      ...parsed.data,
      performedBy: req.user._id,
    });

    return res.json({
      success: true,
      message: "Stock adjustment recorded",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve stock for an authorized branch.
const getInventory = async (req, res, next) => {
  try {
    const parsed = inventoryQuerySchema.safeParse(
      req.query
    );

    if (!parsed.success) {
      return sendValidationError(
        res,
        parsed.error
      );
    }

    const query = parsed.data;

    const branchId =
      req.user.role === "admin"
        ? query.branchId
        : req.user.branch?.toString();

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "A branchId is required for Admin",
      });
    }

    // Do not allow staff to override their branch.
    if (
      query.branchId &&
      !canAccessBranch(req.user, query.branchId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this branch",
      });
    }

    const filter = {
      branch: new mongoose.Types.ObjectId(branchId),
    };

    if (query.lowStock === "true") {
      filter.$expr = {
        $lte: [
          "$quantity",
          "$lowStockThreshold",
        ],
      };
    }

    const stocks = await BranchStock.find(filter)
      .populate({
        path: "variant",
        populate: {
          path: "product",
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const search = query.search?.toLowerCase();

    const filtered = stocks.filter((stock) => {
      const variant = stock.variant;
      const product = variant?.product;

      if (!variant || !product) {
        return false;
      }

      if (
        query.category &&
        product.category !== query.category
      ) {
        return false;
      }

      if (search) {
        const text = [
          product.name,
          product.brand,
          product.category,
          variant.sku,
          variant.size,
          variant.color,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(search)) {
          return false;
        }
      }

      return true;
    });

    const start = (query.page - 1) * query.limit;

    return res.json({
      success: true,
      total: filtered.length,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(
        filtered.length / query.limit
      ),
      inventory: filtered.slice(
        start,
        start + query.limit
      ),
    });
  } catch (error) {
    next(error);
  }
};

// Read traceable stock movements.
const getStockMovements = async (req, res, next) => {
  try {
    const branchId =
      req.user.role === "admin"
        ? req.query.branchId
        : req.user.branch?.toString();

    if (
      !branchId ||
      !mongoose.isValidObjectId(branchId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid branchId required",
      });
    }

    if (
      req.query.branchId &&
      !canAccessBranch(req.user, req.query.branchId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Branch access denied",
      });
    }

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

    const filter = {
      branch: branchId,
    };

    const [total, movements] = await Promise.all([
      StockMovement.countDocuments(filter),

    StockMovement.find(filter)
      .populate("performedBy", "fullName role")
      .populate({
        path: "variant",
        select: "product",
        populate: {
          path: "product",
          select: "name brand category",
        },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ]);

    return res.json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      movements,
    });
  } catch (error) {
    next(error);
  }
};

// Permanently delete one branch stock record. Movement history is retained.
const deleteInventory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory record ID",
      });
    }

    const deleted = await BranchStock.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Inventory record not found",
      });
    }

    return res.json({
      success: true,
      message: "Inventory record permanently deleted",
      deleted: {
        id: deleted._id,
        branchId: deleted.branch,
        variantId: deleted.variant,
        quantity: deleted.quantity,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOpeningStock,
  createAdjustment,
  getInventory,
  getStockMovements,
  deleteInventory,
};
