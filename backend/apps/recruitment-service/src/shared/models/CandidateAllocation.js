const mongoose = require("mongoose");

const candidateAllocationSchema = new mongoose.Schema(
  {
    examScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
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
    centerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamCenter",
      required: true,
    },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRoom" },
    rollNumber: { type: String, required: true, trim: true },
    seatNumber: { type: String, trim: true },
    serialNumber: { type: Number, min: 1 },
    allocationBatchId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["allocated", "blocked", "cancelled"],
      default: "allocated",
    },
    allocationReason: { type: String, trim: true },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    allocatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

candidateAllocationSchema.index(
  { examScheduleId: 1, applicationId: 1 },
  { unique: true },
);
candidateAllocationSchema.index(
  { examScheduleId: 1, rollNumber: 1 },
  { unique: true },
);
candidateAllocationSchema.index({ examScheduleId: 1, centerId: 1, roomId: 1 });
candidateAllocationSchema.index({ candidateId: 1 });

module.exports = mongoose.model("CandidateAllocation", candidateAllocationSchema);
