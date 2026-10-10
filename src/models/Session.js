const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

// TTL cleanup; actual expiry is enforced by middleware.
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model("Session", sessionSchema);