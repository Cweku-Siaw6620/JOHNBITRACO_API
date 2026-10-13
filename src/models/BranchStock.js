
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
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
      validate: Number.isSafeInteger,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One stock record per variant per branch.
branchStockSchema.index(
  {
    branch: 1,
    variant: 1,
  },
  {
    unique: true,
  }
);

branchStockSchema.index({
  branch: 1,
  quantity: 1,
});

module.exports = mongoose.model(
  "BranchStock",
  branchStockSchema
);