const User = require("../models/User");
const Branch = require("../models/Branch");

const {
  validateSession,
  revokeSession,
} = require("../services/sessionService");

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const parts = authorization.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      !/^[a-f0-9]{64}$/i.test(parts[1])
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const session = await validateSession(parts[1]);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid",
      });
    }

    const user = await User.findById(session.user);

    if (!user || !user.isActive) {
      await revokeSession(session._id);

      return res.status(401).json({
        success: false,
        message: "Account unavailable",
      });
    }

    if (user.role !== "admin") {
      const branch = await Branch.findById(user.branch);

      if (!branch || !branch.isActive) {
        await revokeSession(session._id);

        return res.status(403).json({
          success: false,
          message: "Assigned branch unavailable",
        });
      }

      // Prevent the assistant from being moved away
      // from the designated Main Branch.
      if (
        user.role === "assistant" &&
        branch.code !== "MAIN"
      ) {
        return res.status(403).json({
          success: false,
          message: "Invalid assistant branch assignment",
        });
      }
    }

    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;