const serializeUser = (user) => {
  return {
    id: user._id,
    fullName: user.fullName,
    loginId: user.loginId || null,
    role: user.role,
    branch: user.branch || null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
};

module.exports = serializeUser;