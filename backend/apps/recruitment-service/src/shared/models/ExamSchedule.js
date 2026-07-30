const mongoose = require("mongoose");

const paperSchema = new mongoose.Schema(
  {
    paperCode: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    numberOfQuestions: { type: Number, required: true, min: 1 },
    durationMinutes: { type: Number, min: 1 },
    order: { type: Number, default: 1 },
  },
  { _id: true },
);

const instructionSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const examScheduleSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    examName: { type: String, required: true, trim: true },
    examCode: { type: String, required: true, uppercase: true, trim: true },
    commissionName: {
      type: String,
      default: "Jharkhand Staff Selection Commission",
      trim: true,
    },
    commissionNameLocal: {
      type: String,
      default: "झारखंड कर्मचारी चयन आयोग",
      trim: true,
    },
    advertisementNo: { type: String, trim: true },
    shiftName: { type: String, trim: true },
    examDate: { type: Date, required: true },
    reportingTime: { type: String, required: true, trim: true },
    gateClosingTime: { type: String, trim: true },
    examStartTime: { type: String, required: true, trim: true },
    examEndTime: { type: String, trim: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    rollNumberPrefix: { type: String, trim: true },
    rollNumberStart: { type: Number, default: 1, min: 1 },
    rollNumberPadding: { type: Number, default: 6, min: 3, max: 12 },
    papers: [paperSchema],
    instructions: [instructionSchema],
    provisionalNote: { type: String, trim: true },
    selectedCenterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ExamCenter" }],
    status: {
      type: String,
      enum: ["draft", "allocation_ready", "allocated", "locked", "published", "cancelled"],
      default: "draft",
    },
    allocationSummary: {
      eligibleCandidates: { type: Number, default: 0 },
      allocatedCandidates: { type: Number, default: 0 },
      unallocatedCandidates: { type: Number, default: 0 },
      totalCapacity: { type: Number, default: 0 },
      lastAllocatedAt: Date,
    },
    lockedAt: Date,
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

examScheduleSchema.index({ jobId: 1, examCode: 1 }, { unique: true });
examScheduleSchema.index({ status: 1, examDate: 1 });

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);
