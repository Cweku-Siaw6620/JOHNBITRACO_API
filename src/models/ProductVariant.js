const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    size: {
      type: String,
      required: true,
      trim: true,
    },

    color: {
      type: String,
      required: true,
      trim: true,
    },

    retailPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    wholesalePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productVariantSchema.index(
  { product: 1, size: 1, color: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ProductVariant",
  productVariantSchema
);