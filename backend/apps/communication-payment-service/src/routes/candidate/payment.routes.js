const express = require("express");
const router = express.Router();
const paymentController = require("../../controllers/candidate/payment.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");
const validate = require("../../shared/middlewares/validate");
const {
  initiatePaymentSchema,
  verifyPaymentSchema,
} = require("../../shared/validations/payment.validation");

// ── Webhooks (no auth — raw body needed for signature verification) ──
router.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json" }),
  paymentController.razorpayWebhook,
);
router.post(
  "/cashfree/webhook",
  express.raw({ type: "application/json" }),
  paymentController.cashfreeWebhook,
);
router.post(
  "/paytm/webhook",
  express.raw({ type: "application/json" }),
  paymentController.paytmWebhook,
);
router.post(
  "/phonepe/webhook",
  express.raw({ type: "application/json" }),
  paymentController.phonepeWebhook,
);

// ── Authenticated routes ──────────────────────────────────────
router.use(express.json({ limit: "10mb" }));
router.use(express.urlencoded({ extended: true }));
router.use(authenticate, authorize("candidate"));

router.post("/initiate", validate(initiatePaymentSchema), paymentController.initiatePayment);
router.post("/verify", validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get("/history", paymentController.getHistory);
router.get("/:transactionId", paymentController.getByTransaction);

module.exports = router;
