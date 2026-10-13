
const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 25,
    },

    alternatePhone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 25,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 150,
    },

    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
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

// Improve supplier search performance
supplierSchema.index({
  name: 1,
});

// Helpful when looking up suppliers by phone
supplierSchema.index({
  phone: 1,
});

module.exports = mongoose.model(
  "Supplier",
  supplierSchema
);
