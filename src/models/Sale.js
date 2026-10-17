
const mongoose = require("mongoose");

// Money values are stored as integer pesewas.
const moneyField = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};

// Allows null when a cost has not yet been calculated.
const nullableCostField = {
  type: Number,
  min: 0,
  default: null,
  validate: {
    validator(value) {
      return (
        value === null ||
        (Number.isSafeInteger(value) && value >= 0)
      );
    },
    message: "Cost must be a non-negative integer or null",
  },
};

// Gross profit can be negative if a sale is made at a loss.
const nullableProfitField = {
  type: Number,
  default: null,
  validate: {
    validator(value) {
      return (
        value === null ||
        Number.isSafeInteger(value)
      );
    },
    message: "Gross profit must be an integer or null",
  },
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

    costOfGoodsSold: nullableCostField,

    unitPrice: moneyField,

    lineTotal: moneyField,
  },
  {
    _id: false,
  }
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
        validator(items) {
          return items.length > 0;
        },
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
      enum: [
        "completed",
        "partially_returned",
        "returned",
      ],
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

    costOfGoodsSold: nullableCostField,

    grossProfit: nullableProfitField,

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
