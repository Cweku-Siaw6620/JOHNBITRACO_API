const express = require("express");
const rateLimit = require("express-rate-limit");

const authenticate = require("../middlewares/authenticate");

const {
  login,
  getMe,
  changePassword,
  logout,
} = require("../controllers/authController");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  skipSuccessfulRequests: true,

  message: {
    success: false,
    message:
      "Too many failed login attempts. Try again in 5 minutes.",
  },
});

router.post("/login", loginLimiter, login);

router.get("/me", authenticate, getMe);

router.post(
  "/change-password",
  authenticate,
  changePassword
);

router.post("/logout", authenticate, logout);

module.exports = router;