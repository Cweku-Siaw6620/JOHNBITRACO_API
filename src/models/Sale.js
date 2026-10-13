
const mongoose = require("mongoose");

const moneyField = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};

const saleItemSchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    sku: {
      type: String,
      required: true,
    },

    productName: {
      type: String,
      required: true,
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

    priceType: {
      type: String,
      enum: ["retail", "wholesale"],
      required: true,
    },

    unitPrice: moneyField,

    lineTotal: moneyField,
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    items: {
      type: [saleItemSchema],
      validate: {
        validator: items => items.length > 0,
        message: "Sale must contain items",
      },
    },

    subtotal: moneyField,

    discount: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    total: moneyField,

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

    status: {
      type: String,
      enum: ["completed", "partially_returned", "returned"],
      default: "completed",
    },

    requestKey: {
      type: String,
      required: true,
      unique: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    soldAt: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

saleSchema.index({
  branch: 1,
  soldAt: -1,
});

saleSchema.index({
  customer: 1,
  soldAt: -1,
});

saleSchema.index({
  paymentStatus: 1,
});

module.exports = mongoose.model("Sale", saleSchema);
