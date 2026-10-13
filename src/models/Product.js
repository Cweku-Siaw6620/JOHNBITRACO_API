
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    brand: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Executive",
        "Loafers",
        "Boots",
        "Other",
      ],
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Improve product search and filtering.
productSchema.index({
  category: 1,
  name: 1,
});

productSchema.index({
  brand: 1,
});

module.exports = mongoose.model(
  "Product",
  productSchema
);
