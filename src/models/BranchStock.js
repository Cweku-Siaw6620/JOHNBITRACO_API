const mongoose = require("mongoose");

const branchStockSchema = new mongoose.Schema(
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

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
      validate: Number.isInteger,
    },
  },
  { timestamps: true }
);

branchStockSchema.index(
  { branch: 1, variant: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "BranchStock",
  branchStockSchema
);