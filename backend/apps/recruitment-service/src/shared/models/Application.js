const mongoose = require("mongoose");

// ── Sub-schemas ───────────────────────────────────────────

const educationDetailSchema = new mongoose.Schema(
  {
    board: String,
    school: String,
    rollNumber: String,
    year: Number,
    percentage: Number,
    stream: String, // for 12th
    degree: String, // for graduation
    university: String,
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    addressLine1: String,
    addressLine2: String,
    state: String,
    district: String,
    policeStation: String,
    pincode: String,
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    name: { type: String },
    cloudinaryUrl: { type: String },
    cloudinaryPublicId: { type: String },
    localPath: { type: String },
    mimeType: { type: String },
    originalName: { type: String },
    sizeKB: { type: Number },
    status: {
      type: String,
      enum: ["pending", "uploaded", "verified", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    verifiedAt: { type: Date },
    uploadedAt: { type: Date },
  },
  { _id: true },
);

const appliedPostSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    postId: { type: mongoose.Schema.Types.ObjectId },
    postCode: String,
    title: String,
    designation: String,
    department: String,
    vacancies: Number,
    preference: Number,
    fee: Number,
  },
  { _id: false },
);

// ── Main Application Schema ───────────────────────────────

const applicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      unique: true,
      required: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The primary job this application belongs to
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // Multiple posts selected in post-selection step
    appliedPosts: [appliedPostSchema],

    // ── Step 1: Personal Details ──────────────────────────
    personalDetails: {
      fullName: String,
      fatherName: String,
      motherName: String,
      dateOfBirth: Date,
      gender: String,
      category: String,
      maritalStatus: String,
      religion: String,
      identificationMark: String,
      registeredMobile: String,
      isDomicileOfBihar: Boolean,
    },

    // ── Step 2: Education ─────────────────────────────────
    education: {
      tenth: { type: educationDetailSchema },
      twelfth: { type: educationDetailSchema },
      graduation: { type: educationDetailSchema },
      hasPostGraduation: Boolean,
    },

    // ── Step 3: Additional Info ───────────────────────────
    additionalInfo: {
      isGovtEmployee: Boolean,
      departmentName: String,
      yearsOfService: Number,
      isExServiceman: Boolean,
      isPwD: Boolean,
      disabilityType: String,
      disabilityPercentage: Number,
      drivingLicense: String,
      computerCertificate: String,
      subjectCombination: String,
    },

    // ── Step 4: Address ───────────────────────────────────
    address: {
      permanent: { type: addressSchema },
      correspondence: { type: addressSchema },
      sameAsPermanent: Boolean,
    },

    // ── Step 5: Documents ─────────────────────────────────
    documents: [documentSchema],

    // ── Dynamic form responses (from job's formSections) ──
    formResponses: { type: Map, of: mongoose.Schema.Types.Mixed },

    // ── Status ────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "under_review",
        "verified",
        "approved",
        "clarification_required",
        "rejected",
        "shortlisted",
      ],
      default: "draft",
    },
    documentStatus: {
      type: String,
      enum: ["incomplete", "pending", "complete"],
      default: "incomplete",
    },

    // ── Payment ───────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    totalFee: { type: Number, default: 0 },
    transactionId: { type: String },

    // ── Review ────────────────────────────────────────────
    declaration: { type: String },
    score: { type: Number },

    // ── Admin actions ─────────────────────────────────────
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    correction: {
      status: {
        type: String,
        enum: ["none", "requested", "in_progress", "submitted", "resolved"],
        default: "none",
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      requestedAt: { type: Date },
      submittedAt: { type: Date },
      supportTicket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupportTicket",
      },
      note: { type: String },
      issues: [
        {
          section: { type: String },
          fieldKey: { type: String },
          fieldLabel: { type: String },
          issueType: { type: String },
          currentValue: { type: String },
          remark: { type: String },
          status: {
            type: String,
            enum: ["pending", "resolved", "rejected"],
            default: "pending",
          },
          requestedAt: { type: Date },
          resolvedAt: { type: Date },
        },
      ],
    },

    // ── Timestamps ────────────────────────────────────────
    submittedAt: { type: Date },
    lastSavedAt: { type: Date, default: Date.now },

    // ── Current step (for draft tracking) ─────────────────
    currentStep: { type: Number, default: 1, min: 1, max: 30 },

    // ── Public flow fields (NEW) ──────────────────────────

    // Registration number — generated after payment success
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Whether this was submitted via public form (no login)
    isPublicApplication: { type: Boolean, default: false },

    // Payment timing preference
    paymentTiming: {
      type: String,
      enum: ["step1", "last_step"],
      default: "last_step",
    },

    // Contact for OTP verification (used in public flow)
    contactEmail: { type: String },
    contactMobile: { type: String },

    // Exam allocation (populated when admit card is generated)
    examAllocation: {
      examScheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExamSchedule",
      },
      allocatedDate: { type: Date },
      allocatedShift: { type: String },
      preferredCity: { type: String },
      preferredDistrict: { type: String },
      admitCardGenerated: { type: Boolean, default: false },
      admitCardGeneratedAt: { type: Date },
      rollNumber: { type: String },
      seatNumber: { type: String },
      examCenter: { type: mongoose.Schema.Types.Mixed },
    },

    // Correction window tracking
    correctionWindow: {
      startDate: { type: Date },
      endDate: { type: Date },
      isActive: { type: Boolean, default: false },
    },
    corrections: [
      {
        requestId: { type: String },
        requestedAt: { type: Date },
        requestedFields: [
          {
            field: { type: String },
            fieldLabel: { type: String },
            adminIssueId: { type: String },
            oldValue: { type: String },
            newValue: { type: String },
            supportingDocument: { type: String },
            reason: { type: String },
          },
        ],
        reason: { type: String },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "more_info_needed"],
          default: "pending",
        },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        reviewedAt: { type: Date },
        reviewComments: { type: String },
        supportTicketId: { type: mongoose.Schema.Types.ObjectId },
      },
    ],

    // Biometric data (encrypted)
    biometricData: {
      fingerprintsEncrypted: { type: String },
      facePhotoHash: { type: String },
      encryptionAlgorithm: { type: String, default: "AES-256-GCM" },
      uploadedAt: { type: Date },
    },

    // File storage batch info (for 10 lakh+ scale)
    fileStorage: {
      batchNumber: { type: String },
      basePath: { type: String },
      totalStorageUsed: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

applicationSchema.index({ candidateId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ paymentStatus: 1 });
applicationSchema.index({ submittedAt: -1 });
applicationSchema.index({ isPublicApplication: 1 });
applicationSchema.index({ contactMobile: 1 });

module.exports = mongoose.model("Application", applicationSchema);
