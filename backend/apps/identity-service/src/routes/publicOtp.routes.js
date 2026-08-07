const express = require("express");
const router = express.Router();
const publicOtpController = require("../controllers/publicOtp.controller");
const rateLimit = require("express-rate-limit");

// Rate limiter for OTP requests (3 requests per 15 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: {
    success: false,
    message:
      "Too many OTP requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Send OTP
router.post("/send", otpLimiter, publicOtpController.sendOTP);

// Verify OTP
router.post("/verify", publicOtpController.verifyOTP);

// Check if verified
router.post("/check-verification", publicOtpController.checkVerification);

// Get remaining time
router.post("/remaining-time", publicOtpController.getRemainingTime);

module.exports = router;
