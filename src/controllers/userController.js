const mongoose = require("mongoose");

const User = require("../models/User");
const Branch = require("../models/Branch");

const {
  createStaffSchema,
  updateStaffSchema,
  resetPinSchema,
} = require("../validators/authValidators");

const {
  hashCredential,
  createPinLookup,
} = require("../utils/pinUtils");

const serializeUser = require("../utils/serializeUser");

const {
  revokeAllUserSessions,
} = require("../services/sessionService");

const validateStaffBranch = async (branchId, role) => {
  const branch = await Branch.findById(branchId);

  if (!branch || !branch.isActive) {
    return "Invalid or inactive branch";
  }

  if (role === "assistant" && branch.code !== "MAIN") {
    return "Assistants must belong to Main Branch";
  }

  return null;
};

const createUser = async (req, res, next) => {
  try {
    const parsed = createStaffSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff information",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const branchError = await validateStaffBranch(
      data.branch,
      data.role
    );

    if (branchError) {
      return res.status(400).json({
        success: false,
        message: branchError,
      });
    }

    const loginId = data.loginId
      ? data.loginId.toUpperCase()
      : null;

    if (loginId) {
      const existing = await User.findOne({ loginId });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Staff ID already exists",
        });
      }
    }

    const pinLookup =
      data.role === "employee"
        ? createPinLookup(data.pin)
        : null;

    if (pinLookup) {
      const existingPin = await User.findOne({
        pinLookup,
      }).select("+pinLookup");

      if (existingPin) {
        return res.status(409).json({
          success: false,
          message: "PIN is already assigned to another employee",
        });
      }
    }

    const credentialHash = await hashCredential(
      data.pin
    );

    const user = await User.create({
      fullName: data.fullName,
      loginId,
      role: data.role,
      branch: data.branch,
      credentialHash,
      pinLookup,
      isActive: true,
    });

    await user.populate(
      "branch",
      "name code location"
    );

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .populate("branch", "name code location")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({
      success: true,
      count: users.length,
      users: users.map(serializeUser),
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const parsed = updateStaffSchema.safeParse(
      req.body
    );

    if (
      !parsed.success ||
      Object.keys(parsed.data || {}).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid update information",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot modify Admin through staff management",
      });
    }

    const changes = parsed.data;

    const nextBranch = changes.branch || user.branch;

    const branchError = await validateStaffBranch(
      nextBranch,
      user.role
    );

    if (branchError) {
      return res.status(400).json({
        success: false,
        message: branchError,
      });
    }

    const shouldRevokeSessions =
      (
        changes.branch &&
        changes.branch !== user.branch.toString()
      ) ||
      (
        changes.isActive !== undefined &&
        changes.isActive !== user.isActive
      );

    Object.assign(user, changes);

    await user.save();

    if (shouldRevokeSessions) {
      await revokeAllUserSessions(user._id);
    }

    await user.populate(
      "branch",
      "name code location"
    );

    return res.json({
      success: true,
      message: "Staff account updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const resetPin = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const parsed = resetPinSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "PIN must contain exactly 5 digits",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user || user.role === "admin") {
      return res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
    }

    const { pin } = parsed.data;

    let pinLookup = null;

    if (user.role === "employee") {
      pinLookup = createPinLookup(pin);

      const existing = await User.findOne({
        pinLookup,
        _id: { $ne: user._id },
      }).select("+pinLookup");

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "PIN is already assigned to another employee",
        });
      }
    }

    const credentialHash = await hashCredential(pin);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          credentialHash,
          pinLookup,
          failedAttempts: 0,
          lockedUntil: null,
        },
      }
    );

    await revokeAllUserSessions(user._id);

    return res.json({
      success: true,
      message: "Staff PIN reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  resetPin,
};