const bcrypt = require("bcryptjs");

const User = require("../models/User");

const {
  loginSchema,
  changePasswordSchema,
} = require("../validators/authValidators");

const {
  createPinLookup,
  verifyCredential,
  hashCredential,
} = require("../utils/pinUtils");

const serializeUser = require("../utils/serializeUser");

const {
  createSession,
  revokeSession,
  revokeAllUserSessions,
} = require("../services/sessionService");

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const INVALID_LOGIN = "Invalid login credentials";

const respondInvalid = (res) => {
  return res.status(401).json({
    success: false,
    message: INVALID_LOGIN,
  });
};

const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});

    console.log("LOGIN DEBUG:", {
  method: req.method,
  url: req.originalUrl,
  contentType: req.headers["content-type"],
  bodyKeys: Object.keys(req.body || {}),
});

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid login information",
        errors: parsed.error.issues,
      });
    }

    const { role } = parsed.data;
    let user;
    let credential;

    if (role === "admin") {
      user = await User.findOne({
        role: "admin",
        loginId: parsed.data.loginId.toUpperCase(),
      }).select("+credentialHash");

      credential = parsed.data.password;
    }

    console.log("ADMIN CHECK:", {
  found: !!user,
  role: user?.role,
  loginId: user?.loginId,
  active: user?.isActive,
  hasCredentialHash: !!user?.credentialHash,
  mustChangePassword: user?.mustChangePassword,
});

    if (role === "assistant") {
      user = await User.findOne({
        role: "assistant",
        loginId: parsed.data.loginId.toUpperCase(),
      }).select("+credentialHash");

      credential = parsed.data.pin;
    }

    if (role === "employee") {
      const lookup = createPinLookup(parsed.data.pin);

      user = await User.findOne({
        role: "employee",
        pinLookup: lookup,
      }).select("+credentialHash");

      credential = parsed.data.pin;
    }

    if (!user || !user.isActive) {
      return respondInvalid(res);
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      return res.status(429).json({
        success: false,
        message: "Account temporarily locked. Try again later.",
      });
    }

    const valid = await verifyCredential(credential, user.credentialHash);

    if (!valid) {
      const attempts = user.failedAttempts + 1;

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            failedAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,

            lockedUntil:
              attempts >= MAX_ATTEMPTS
                ? new Date(Date.now() + LOCKOUT_MS)
                : null,
          },
        },
      );

      return respondInvalid(res);
    }

    if (role !== "admin") {
      const Branch = require("../models/Branch");

      const branch = await Branch.findById(user.branch);

      if (!branch || !branch.isActive) {
        return res.status(403).json({
          success: false,
          message: "Assigned branch unavailable",
        });
      }
    }
    
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
    );

    const token = await createSession(user._id);

    await user.populate("branch", "name code location");

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    await req.user.populate("branch", "name code location");

    return res.json({
      success: true,
      user: serializeUser(req.user),
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only the Admin uses password authentication",
      });
    }

    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid password information",
        errors: parsed.error.flatten(),
      });
    }

    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different",
      });
    }

    const user = await User.findById(req.user._id).select("+credentialHash");

    const valid = await bcrypt.compare(currentPassword, user.credentialHash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const newHash = await hashCredential(newPassword);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          credentialHash: newHash,
          mustChangePassword: false,
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
    );

    await revokeAllUserSessions(user._id);

    return res.json({
      success: true,
      message: "Password changed. Please log in again.",
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await revokeSession(req.session._id);

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  changePassword,
  logout,
};
