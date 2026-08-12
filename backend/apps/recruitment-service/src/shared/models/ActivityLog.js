const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "VIEW",
        "DOWNLOAD",
        "LOGIN",
        "LOGOUT",
        "PUBLISH",
        "UNPUBLISH",
        "ALLOCATE",
        "LOCK",
        "GENERATE",
        "REGENERATE",
        "BULK_DOWNLOAD",
        "EXPORT",
        "RETRY",
        "APPROVE",
        "REJECT",
      ],
      required: true,
    },
    module: {
      type: String,
      enum: [
        "Jobs",
        "Applications",
        "Projects",
        "Employees",
        "Roles",
        "Support",
        "Payments",
        "Settings",
        "Analytics",
        "Results",
        "AdmitCards",
      ],
      required: true,
    },
    details: { type: String },
    resourceId: { type: String }, // ID of the affected resource
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
    // TTL index: auto-delete logs older than 1 year
    expireAfterSeconds: 365 * 24 * 60 * 60,
  },
);

activityLogSchema.index({ employeeId: 1 });
activityLogSchema.index({ module: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
