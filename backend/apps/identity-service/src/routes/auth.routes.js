const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const validate = require("../shared/middlewares/validate");
const authenticate = require("../shared/middlewares/authenticate");
const {
  authLimiter,
  otpLimiter,
} = require("../shared/middlewares/rateLimiter");
const {
  registerSchema,
  verifyOTPSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../shared/validations/auth.validation");

// ── Public routes ─────────────────────────────────────────────
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/verify-otp",
  otpLimiter,
  validate(verifyOTPSchema),
  authController.verifyOTP,
);
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.loginCandidate,
);
router.post(
  "/admin/login",
  authLimiter,
  validate(loginSchema),
  authController.loginAdmin,
);
router.post(
  "/employee/login",
  authLimiter,
  validate(loginSchema),
  authController.loginEmployee,
);
router.post("/refresh-token", authController.refreshToken);
router.post(
  "/forgot-password",
  otpLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  otpLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post("/resend-otp", authController.resendOTP);

// ── Protected routes ──────────────────────────────────────────
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/change-password", authenticate, authController.changePassword);

module.exports = router;
