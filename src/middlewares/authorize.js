const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      req.user.role === "admin" &&
      req.user.mustChangePassword
    ) {
      return res.status(403).json({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Change your temporary password first",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};

const canAccessBranch = (user, branchId) => {
  if (!user || !branchId) {
    return false;
  }

  if (user.role === "admin") {
    return !user.mustChangePassword;
  }

  return (
    user.branch &&
    user.branch.toString() === branchId.toString()
  );
};

const canManageBranch = (user, branchId) => {
  if (!canAccessBranch(user, branchId)) {
    return false;
  }

  return ["admin", "assistant"].includes(user.role);
};

module.exports = {
  authorize,
  canAccessBranch,
  canManageBranch,
};