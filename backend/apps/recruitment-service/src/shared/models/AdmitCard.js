const mongoose = require("mongoose");

const admitCardSchema = new mongoose.Schema(
  {
    examScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    allocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CandidateAllocation",
      required: true,
      unique: true,
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
    admitCardNumber: { type: String, required: true, unique: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    barcodeValue: { type: String, required: true, trim: true },
    qrPayload: { type: String, trim: true },
    pdfUrl: { type: String, trim: true },
    pdfPublicId: { type: String, trim: true },
    pdfChecksum: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "generated", "published", "revoked"],
      default: "draft",
    },
    version: { type: Number, default: 1, min: 1 },
    generatedAt: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    revokedAt: Date,
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    revokeReason: { type: String, trim: true },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: Date,
  },
  { timestamps: true },
);

admitCardSchema.index({ examScheduleId: 1, applicationId: 1 }, { unique: true });
admitCardSchema.index({ examScheduleId: 1, status: 1 });
admitCardSchema.index({ candidateId: 1, status: 1 });
admitCardSchema.index({ barcodeValue: 1 });
admitCardSchema.index({ examScheduleId: 1, status: 1, rollNumber: 1 });
admitCardSchema.index({ candidateId: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model("AdmitCard", admitCardSchema);
