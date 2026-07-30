const mongoose = require("mongoose");

const bulkExamJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "allocation",
        "admit_card_generation",
        "admit_card_zip",
        "attendance_zip",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    examScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    progress: {
      total: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      message: { type: String, trim: true },
    },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: {
      filePath: { type: String, trim: true },
      fileName: { type: String, trim: true },
      mimeType: { type: String, trim: true },
      size: { type: Number, default: 0 },
      summary: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    errors: [
      {
        message: String,
        stack: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

bulkExamJobSchema.index({ examScheduleId: 1, type: 1, createdAt: -1 });
bulkExamJobSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model("BulkExamJob", bulkExamJobSchema);
