
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
      uppercase: true,
      trim: true,
      maxlength: 60,
    },

    size: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    color: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
    },

    // All monetary values are in pesewas.
    retailPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    wholesalePrice: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    // Reference cost, not the official cost of
    // historical sales or inventory purchases.
    referenceCost: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Every SKU must be globally unique.
productVariantSchema.index(
  { sku: 1 },
  { unique: true }
);

// Prevent duplicate size/color combinations
// for the same product.
productVariantSchema.index(
  {
    product: 1,
    size: 1,
    color: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "ProductVariant",
  productVariantSchema
);