const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "recipientModel",
      required: true,
    },
    recipientModel: {
      type: String,
      enum: ["User", "Employee"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "application_submitted",
        "application_approved",
        "application_rejected",
        "application_correction",
        "application_updated",
        "document_verified",
        "document_rejected",
        "payment_success",
        "payment_failed",
        "admit_card_available",
        "result_published",
        "ticket_reply",
        "ticket_resolved",
        "new_job_posted",
        "system_audit",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    link: { type: String }, // frontend route to navigate to
    metadata: { type: Map, of: String },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
