
const mongoose = require("mongoose");

const moneyField = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};

const purchaseItemSchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: String,
      required: true,
    },

    color: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    // Actual purchase cost per pair, in pesewas.
    unitCost: moneyField,

    totalCost: moneyField,
  },
  {
    _id: false,
  }
);

const purchaseSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Purchase must contain at least one item",
      },
    },

    totalCost: moneyField,

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },

    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "momo",
        "bank",
        "mixed",
        "none",
      ],
      default: "none",
    },

    supplierInvoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    // Unique identifier for retry protection.
    requestKey: {
      type: String,
      required: true,
      unique: true,
    },

    purchasedAt: {
      type: Date,
      default: Date.now,
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

purchaseSchema.index({
  branch: 1,
  purchasedAt: -1,
});

purchaseSchema.index({
  supplier: 1,
  purchasedAt: -1,
});

purchaseSchema.index({
  paymentStatus: 1,
});

module.exports = mongoose.model(
  "Purchase",
  purchaseSchema
);
