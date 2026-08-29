const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    gateway: {
      type: String,
      enum: ["razorpay", "payu", "ccavenue", "billdesk"],
      required: true,
    },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewaySignature: { type: String },
    method: {
      type: String,
      enum: ["card", "upi", "netbanking", "wallet"],
    },
    status: {
      type: String,
      enum: ["initiated", "pending", "success", "failed", "refunded"],
      default: "initiated",
    },
    failureReason: { type: String },
    refundId: { type: String },
    refundAmount: { type: Number },
    refundedAt: { type: Date },
    paidAt: { type: Date },
    metadata: { type: Map, of: String },
  },
  { timestamps: true },
);

paymentSchema.index({ candidateId: 1 });
paymentSchema.index({ applicationId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ candidateId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ gateway: 1, status: 1, createdAt: -1 });
paymentSchema.index(
  { gatewayPaymentId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { gatewayPaymentId: { $type: "string" } },
  },
);
paymentSchema.index({ applicationId: 1, candidateId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
