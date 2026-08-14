const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const skipRateLimit = () =>
  process.env.DISABLE_RATE_LIMITS === "true" ||
  (env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_RATE_LIMITS !== "true");

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.RATE_LIMIT_MAX, // 100 requests per window
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many requests. Please try again later.",
  },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// OTP limiter
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many OTP requests. Please try again after 10 minutes.",
  },
});

const publicAdmitCardLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many admit card requests. Please try again later.",
  },
});

module.exports = { apiLimiter, authLimiter, otpLimiter, publicAdmitCardLimiter };
