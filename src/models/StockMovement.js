
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "OPENING_STOCK",
        "PURCHASE",
        "SALE",
        "SALE_RETURN",
        "PURCHASE_RETURN",
        "ADJUSTMENT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ],
    },

    // Positive = stock added.
    // Negative = stock deducted.
    quantityChange: {
      type: Number,
      required: true,
      validate: {
        validator: (value) =>
          Number.isSafeInteger(value) &&
          value !== 0,
        message:
          "Quantity change must be a non-zero integer",
      },
    },

    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    referenceType: {
      type: String,
      enum: [
        "OpeningStock",
        "Purchase",
        "Sale",
        "Return",
        "StockAdjustment",
        "StockTransfer",
      ],
      default: "StockAdjustment",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({
  branch: 1,
  createdAt: -1,
});

stockMovementSchema.index({
  variant: 1,
  createdAt: -1,
});

stockMovementSchema.index({
  referenceType: 1,
  referenceId: 1,
});

module.exports = mongoose.model(
  "StockMovement",
  stockMovementSchema
);
