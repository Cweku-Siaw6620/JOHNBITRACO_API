
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    // Admin and Assistant login ID
    // Employees do not require a login ID
    loginId: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },

    role: {
      type: String,
      enum: ["admin", "assistant", "employee"],
      required: true,
    },

    // Admin has access to all branches
    // Assistant and Employee belong to one branch
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      required: function () {
        return this.role !== "admin";
      },
    },

    // Stores hashed Admin password or staff PIN
    credentialHash: {
      type: String,
      required: true,
      select: false,
    },

    // HMAC lookup for employee PIN-only login
    pinLookup: {
      type: String,
      default: null,
      select: false,
    },

    // Forces Admin to change initial password
    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Number of failed login attempts
    failedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Temporary account lockout
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique Admin/Assistant login IDs
userSchema.index(
  { loginId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      loginId: { $type: "string" },
    },
  }
);

// Unique employee PIN lookups
userSchema.index(
  { pinLookup: 1 },
  {
    unique: true,
    partialFilterExpression: {
      pinLookup: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("User", userSchema);