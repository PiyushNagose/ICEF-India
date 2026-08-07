const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const ctrl = require("../../controllers/public/status.controller");

const statusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const correctionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: "Too many correction requests." },
});

// POST /api/public/application/status
router.post("/status", statusLimiter, ctrl.checkStatus);

// POST /api/public/application/request-correction
router.post("/request-correction", correctionLimiter, ctrl.requestCorrection);

// GET  /api/public/application/correction-status/:requestId
router.get(
  "/correction-status/:requestId",
  statusLimiter,
  ctrl.getCorrectionStatus,
);

module.exports = router;
