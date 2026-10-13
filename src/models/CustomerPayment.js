
const mongoose = require("mongoose");

const customerPaymentSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    method: {
      type: String,
      enum: ["cash", "momo", "bank"],
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    requestKey: {
      type: String,
      default: null,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Unique keys for subsequent repayments.
// Older or initial payments may have no key.
customerPaymentSchema.index(
  { requestKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestKey: { $type: "string" },
    },
  }
);

customerPaymentSchema.index({
  sale: 1,
  paidAt: -1,
});

customerPaymentSchema.index({
  customer: 1,
  paidAt: -1,
});

module.exports = mongoose.model(
  "CustomerPayment",
  customerPaymentSchema
);
