const express = require("express");
const router = express.Router();
const publicOtpController = require("../controllers/publicOtp.controller");
const rateLimit = require("express-rate-limit");
const env = require("../shared/config/env");

const normalizeOtpIdentifier = (req) => {
  const type = String(req.body?.type || "").toLowerCase();
  const rawIdentifier = String(req.body?.identifier || "").trim();
  if (type === "email") return rawIdentifier.toLowerCase();
  if (type === "mobile") {
    const digits = rawIdentifier.replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits;
  }
  return rawIdentifier.toLowerCase();
};

const ipKeyGenerator =
  rateLimit.ipKeyGenerator || ((ip) => String(ip || "unknown"));

// Public OTP limiter: generous in local/demo, stricter in production, and scoped
// by requested email/mobile so one tester does not block every OTP screen.
const otpLimiter = rateLimit({
  windowMs: env.PUBLIC_OTP_IP_WINDOW_MS,
  max: env.PUBLIC_OTP_IP_MAX,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${normalizeOtpIdentifier(req) || "unknown"}`,
  message: {
    success: false,
    statusCode: 429,
    message:
      "Too many OTP requests. Please wait a minute and try again.",
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
