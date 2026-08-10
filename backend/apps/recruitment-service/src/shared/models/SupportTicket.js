const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "replies.sentByModel",
    },
    sentByModel: { type: String, enum: ["User", "Employee"] },
    sentByName: { type: String },
    attachments: [String],
  },
  { timestamps: true },
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["Technical", "Payment", "General", "Document", "Application"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
    },

    source: {
      type: String,
      enum: ["web", "candidate_portal", "email", "phone", "whatsapp"],
      default: "candidate_portal",
      index: true,
    },
    sourceMetadata: {
      ip: String,
      userAgent: String,
      channelMessageId: String,
    },
    guestContact: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      mobile: { type: String, trim: true },
    },
    registrationNumber: { type: String, trim: true, index: true },
    linkedApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },
    linkedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    resolutionAction: {
      type: {
        type: String,
        enum: ["none", "application_correction", "payment_verification"],
        default: "none",
      },
      status: {
        type: String,
        enum: [
          "not_required",
          "requested",
          "candidate_action_required",
          "candidate_completed",
          "admin_completed",
        ],
        default: "not_required",
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      requestedAt: { type: Date },
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "resolutionAction.completedByModel",
      },
      completedByModel: { type: String, enum: ["User", "Employee"] },
      completedAt: { type: Date },
      note: { type: String },
    },
    sla: {
      firstResponseDueAt: Date,
      resolutionDueAt: Date,
      firstRespondedAt: Date,
      breached: { type: Boolean, default: false },
    },

    // Raised by candidate
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    raisedByEmail: { type: String },

    // Assigned to employee
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    replies: [replySchema],
    attachments: [String],

    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

supportTicketSchema.index({ raisedBy: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ assignedTo: 1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
