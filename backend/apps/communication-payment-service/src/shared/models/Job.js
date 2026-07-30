const mongoose = require("mongoose");

// ── Sub-schemas ───────────────────────────────────────────

const reservedPostsSchema = new mongoose.Schema(
  { sc: Number, st: Number, obc: Number, ews: Number, pwd: Number },
  { _id: false },
);

const salaryRangeSchema = new mongoose.Schema(
  { min: Number, max: Number },
  { _id: false },
);

const applicationFeeSchema = new mongoose.Schema(
  { general: Number, obc: Number, scSt: Number, ews: Number, pwd: Number },
  { _id: false },
);

const ageRelaxationSchema = new mongoose.Schema(
  { sc: Number, st: Number, obc: Number, pwd: Number },
  { _id: false },
);

const ageLimitSchema = new mongoose.Schema(
  {
    min: Number,
    max: Number,
    relaxation: { type: ageRelaxationSchema, default: () => ({}) },
  },
  { _id: false },
);

const educationRequirementSchema = new mongoose.Schema(
  {
    degree: String,
    specialization: String,
    university: { type: String, default: "Any recognized university" },
  },
  { _id: false },
);

const experienceSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    years: Number,
    type: String,
    description: String,
  },
  { _id: false },
);

const physicalStandardsSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    height: { male: Number, female: Number },
    chest: { male: Number, female: Number },
    weight: { male: Number, female: Number },
  },
  { _id: false },
);

const medicalStandardsSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    vision: String,
    hearing: String,
    other: String,
  },
  { _id: false },
);

// Dynamic form builder schemas
const formFieldSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "text",
        "textarea",
        "email",
        "tel",
        "number",
        "date",
        "select",
        "radio",
        "checkbox",
        "file",
      ],
      required: true,
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    placeholder: String,
    options: [String], // for select/radio
    validation: {
      min: Number,
      max: Number,
      pattern: String,
      message: String,
    },
  },
  { _id: true },
);

const formSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    required: { type: Boolean, default: false },
    fields: [formFieldSchema],
  },
  { _id: true },
);

const documentRequirementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    required: { type: Boolean, default: true },
    formats: [String],
    maxSizeKB: Number,
  },
  { _id: true },
);

const paymentConfigSchema = new mongoose.Schema(
  {
    applicationFee: Number,
    examFee: Number,
    processingFee: Number,
    paymentDeadline: Date,
    paymentMethods: [
      { type: String, enum: ["razorpay", "payu", "ccavenue", "billdesk"] },
    ],
    refundPolicy: String,
    paymentDeadlineHours: { type: Number, default: 24 },
  },
  { _id: false },
);

// ── Main Job Schema ───────────────────────────────────────

const jobSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    postCode: { type: String, required: true, trim: true, unique: true },
    department: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["General", "Technical", "Administrative", "Teaching"],
      default: "General",
    },
    jobType: {
      type: String,
      enum: ["Permanent", "Contract", "Temporary"],
      default: "Permanent",
    },
    workLocation: { type: String, trim: true },
    description: { type: String, trim: true },

    // Vacancy details
    totalPosts: { type: Number, required: true, min: 1 },
    reservedPosts: { type: reservedPostsSchema, default: () => ({}) },
    salaryRange: { type: salaryRangeSchema, default: () => ({}) },
    applicationFee: { type: applicationFeeSchema, default: () => ({}) },

    // Dates
    applicationStartDate: { type: Date },
    applicationDeadline: { type: Date },
    correctionStartDate: { type: Date },
    correctionDeadline: { type: Date },
    admitCardReleaseDate: { type: Date },
    examDate: { type: Date },
    resultDate: { type: Date },

    // Eligibility
    ageLimit: { type: ageLimitSchema, default: () => ({}) },
    education: {
      essential: [educationRequirementSchema],
      desirable: [educationRequirementSchema],
    },
    experience: { type: experienceSchema, default: () => ({}) },
    physicalStandards: { type: physicalStandardsSchema, default: () => ({}) },
    medicalStandards: { type: medicalStandardsSchema, default: () => ({}) },
    otherRequirements: [String],

    // Dynamic form
    formSections: [formSectionSchema],

    // Document requirements
    documentRequirements: [documentRequirementSchema],

    // Payment config
    paymentConfig: { type: paymentConfigSchema, default: () => ({}) },

    // Status
    status: {
      type: String,
      enum: ["draft", "active", "closed", "completed", "cancelled"],
      default: "draft",
    },

    // Stats (updated via background jobs)
    totalApplicants: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

jobSchema.index({ projectId: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ applicationDeadline: 1 });

module.exports = mongoose.model("Job", jobSchema);
