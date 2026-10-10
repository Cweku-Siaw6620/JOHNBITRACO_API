const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    brand: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      required: true,
      enum: ["Executive", "Loafers", "Boots", "Other"],
    },

    description: {
      type: String,
      default: "",
    },

    imageUrl: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);