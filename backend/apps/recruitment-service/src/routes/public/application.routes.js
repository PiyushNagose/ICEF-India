const express = require("express");

const router = express.Router();

const legacyPublicApplyDisabled = (_req, res) => {
  res.status(410).json({
    success: false,
    statusCode: 410,
    message:
      "Legacy public application API is disabled. Use /apply/:slug/start to verify OTP, create a candidate session, and continue through the candidate application flow.",
  });
};

router.all("*", legacyPublicApplyDisabled);

module.exports = router;
