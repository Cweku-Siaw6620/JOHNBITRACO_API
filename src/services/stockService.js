
const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const ProductVariant = require("../models/ProductVariant");
const BranchStock = require("../models/BranchStock");
const StockMovement = require("../models/StockMovement");

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const checkReferences = async (
  branchId,
  variantId,
  session
) => {
  const branch = await Branch.findById(branchId)
    .session(session);

  if (!branch || !branch.isActive) {
    fail("Branch not found or inactive", 404);
  }

  const variant = await ProductVariant.findById(
    variantId
  )
    .populate("product")
    .session(session);

  if (
    !variant ||
    !variant.isActive ||
    !variant.product ||
    !variant.product.isActive
  ) {
    fail("Product variant not found or inactive", 404);
  }

  return { branch, variant };
};

// Initialize a variant's stock at a branch.
// Opening stock is only allowed once per branch/variant.
const addOpeningStock = async ({
  branchId,
  variantId,
  quantity,
  lowStockThreshold = 5,
  reason,
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      await checkReferences(
        branchId,
        variantId,
        session
      );

      const existing = await BranchStock.findOne({
        branch: branchId,
        variant: variantId,
      }).session(session);

      if (existing) {
        fail(
          "Opening stock already exists for this variant and branch",
          409
        );
      }

      const [stock] = await BranchStock.create(
        [
          {
            branch: branchId,
            variant: variantId,
            quantity,
            lowStockThreshold,
            updatedBy: performedBy,
          },
        ],
        { session }
      );

      const [movement] = await StockMovement.create(
        [
          {
            branch: branchId,
            variant: variantId,
            type: "OPENING_STOCK",
            quantityChange: quantity,
            quantityBefore: 0,
            quantityAfter: quantity,
            reason,
            referenceType: "OpeningStock",
            referenceId: stock._id,
            performedBy,
          },
        ],
        { session }
      );

      result = {
        stock,
        movement,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// Increase or decrease stock with an audit record.
// The conditional update prevents negative stock.
const adjustStock = async ({
  branchId,
  variantId,
  quantityChange,
  reason,
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      await checkReferences(
        branchId,
        variantId,
        session
      );

      const filter = {
        branch: branchId,
        variant: variantId,
      };

      if (quantityChange < 0) {
        filter.quantity = {
          $gte: Math.abs(quantityChange),
        };
      }

      const stock = await BranchStock.findOneAndUpdate(
        filter,
        {
          $inc: {
            quantity: quantityChange,
          },
          $set: {
            updatedBy: performedBy,
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!stock) {
        fail(
          "Stock record missing or insufficient quantity",
          409
        );
      }

      const quantityAfter = stock.quantity;

      const quantityBefore =
        quantityAfter - quantityChange;

      const [movement] = await StockMovement.create(
        [
          {
            branch: branchId,
            variant: variantId,
            type: "ADJUSTMENT",
            quantityChange,
            quantityBefore,
            quantityAfter,
            reason,
            referenceType: "StockAdjustment",
            performedBy,
          },
        ],
        { session }
      );

      result = {
        stock,
        movement,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  addOpeningStock,
  adjustStock,
};
