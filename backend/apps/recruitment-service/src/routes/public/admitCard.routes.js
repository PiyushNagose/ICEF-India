const express = require("express");
const { z } = require("zod");
const admitCardController = require("../../controllers/public/admitCard.controller");
const validate = require("../../shared/middlewares/validate");
const { publicAdmitCardLimiter } = require("../../shared/middlewares/rateLimiter");

const router = express.Router();

const lookupSchema = z.object({
  applicationId: z.string().min(3).max(40),
  dateOfBirth: z.string().min(8).max(20),
});

router.use(publicAdmitCardLimiter);

router.post("/lookup", validate(lookupSchema), admitCardController.lookupAdmitCard);
router.get("/verify/:token", admitCardController.verifyAdmitCard);

module.exports = router;
