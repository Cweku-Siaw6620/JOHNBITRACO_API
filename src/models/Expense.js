
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "rent",
        "electricity",
        "water",
        "salaries",
        "transport",
        "packaging",
        "repairs",
        "internet",
        "marketing",
        "utilities",
        "other",
      ],
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // Amount is stored in pesewas.
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "momo", "bank"],
    },

    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    expenseDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted",
    },

    reversalReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    reversedAt: {
      type: Date,
      default: null,
    },

    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    requestKey: {
      type: String,
      required: true,
      unique: true,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

expenseSchema.index({
  branch: 1,
  expenseDate: -1,
});

expenseSchema.index({
  category: 1,
  expenseDate: -1,
});

expenseSchema.index({
  status: 1,
});

module.exports = mongoose.model(
  "Expense",
  expenseSchema
);
