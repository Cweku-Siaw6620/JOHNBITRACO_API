
const mongoose = require("mongoose");

const supplierPaymentSchema = new mongoose.Schema(
  {
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
    },

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

    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    method: {
      type: String,
      required: true,
      enum: ["cash", "momo", "bank"],
    },

    reference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // Optional for older initial purchase payments;
    // mandatory for new repayment API requests.
    requestKey: {
      type: String,
      default: null,
      trim: true,
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
  {
    timestamps: true,
  }
);

// Ensure repayments are never duplicated
// using the same request key.
supplierPaymentSchema.index(
  { requestKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestKey: { $type: "string" },
    },
  }
);

supplierPaymentSchema.index({
  purchase: 1,
  paidAt: -1,
});

supplierPaymentSchema.index({
  supplier: 1,
  paidAt: -1,
});

module.exports = mongoose.model(
  "SupplierPayment",
  supplierPaymentSchema
);
