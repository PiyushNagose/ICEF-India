const express = require("express");
const { z } = require("zod");
const admitCardController = require("../../controllers/public/admitCard.controller");
const validate = require("../../shared/middlewares/validate");
const {
  publicAdmitCardLimiter,
} = require("../../shared/middlewares/rateLimiter");
const {
  normalizeOtpIdentifier,
  assertOTPVerified,
} = require("../../shared/utils/publicOtp");

const router = express.Router();

const lookupSchema = z
  .object({
    // Old lookup (applicationId + DOB)
    applicationId: z.string().min(3).max(40).optional(),
    dateOfBirth: z.string().min(8).max(20).optional(),
    // New lookup (registrationNumber + mobile — OTP must be verified in Redis)
    registrationNumber: z.string().min(6).max(30).optional(),
    mobile: z.string().min(10).max(15).optional(),
  })
  .refine(
    (d) =>
      (d.registrationNumber && d.mobile) || (d.applicationId && d.dateOfBirth),
    {
      message:
        "Provide either (registrationNumber + mobile) or (applicationId + dateOfBirth)",
    },
  );

// Middleware: verify mobile OTP if registrationNumber flow
const verifyMobileOtpIfNeeded = async (req, _res, next) => {
  const { registrationNumber } = req.body;
  if (!registrationNumber) return next();

  req.body.mobile = normalizeOtpIdentifier(req.body.mobile, "mobile");
  await assertOTPVerified(req.body.mobile, "mobile");
  next();
};

router.use(publicAdmitCardLimiter);

router.post(
  "/lookup",
  validate(lookupSchema),
  verifyMobileOtpIfNeeded,
  admitCardController.lookupAdmitCard,
);
router.get("/verify/:token", admitCardController.verifyAdmitCard);

module.exports = router;
