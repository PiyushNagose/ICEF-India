const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const {
  generateApplicationId,
  getPaginationParams,
  calculateFee,
} = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const {
  emitToAdmins,
  emitToCandidate,
  SOCKET_EVENTS,
} = require("../socket/index");
const { publishToQueue, QUEUES } = require("../config/rabbitmq");
const {
  assertApplicationWindowOpen,
  getEffectiveJobStatus,
} = require("../utils/timeline");

// ── Candidate: Start / get draft ─────────────────────────────

const startApplication = async (candidateId, jobId) => {
  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(404, "Job not found");
  if (getEffectiveJobStatus(job) !== "active")
    throw new ApiError(400, "This job is not accepting applications");
  assertApplicationWindowOpen(job);

  // Check if already applied
  const existing = await Application.findOne({
    candidateId,
    jobId,
    status: { $ne: "draft" },
  });
  if (existing)
    throw new ApiError(409, "You have already applied for this job");

  // Return existing draft if present
  const draft = await Application.findOne({
    candidateId,
    jobId,
    status: "draft",
  });
  if (draft) return draft;

  const applicationId = generateApplicationId();
  const application = await Application.create({
    applicationId,
    candidateId,
    jobId,
    status: "draft",
    currentStep: 1,
  });

  return application;
};

// ── Candidate: Save each step ─────────────────────────────────

const saveStep = async (applicationId, candidateId, step, data) => {
  const application = await Application.findOne({
    _id: applicationId,
    candidateId,
  });
  if (!application) throw new ApiError(404, "Application not found");
  if (application.status !== "draft")
    throw new ApiError(400, "Application already submitted");

  const stepMap = {
    "personal-details": { field: "personalDetails", step: 1 },
    education: { field: "education", step: 2 },
    "additional-info": { field: "additionalInfo", step: 3 },
    address: { field: "address", step: 4 },
    "post-selection": { field: "appliedPosts", step: 7 },
  };

  const stepInfo = stepMap[step];
  if (!stepInfo) throw new ApiError(400, "Invalid step");

  application[stepInfo.field] = data;
  application.currentStep = Math.max(
    application.currentStep,
    stepInfo.step + 1,
  );
  application.lastSavedAt = new Date();
  await application.save();

  // Emit autosave confirmation to candidate
  emitToCandidate(candidateId.toString(), "application:autosaved", {
    applicationId,
    step,
    savedAt: application.lastSavedAt,
  });

  return application;
};

// ── Candidate: Submit application ────────────────────────────

const submitApplication = async (applicationId, candidateId, declaration) => {
  const application = await Application.findOne({
    _id: applicationId,
    candidateId,
  }).populate("jobId", "title department applicationFee");
  if (!application) throw new ApiError(404, "Application not found");
  if (application.status !== "draft")
    throw new ApiError(400, "Application already submitted");

  // Validate required steps are filled
  if (!application.personalDetails?.fullName)
    throw new ApiError(400, "Personal details are incomplete");
  if (!application.education?.tenth)
    throw new ApiError(400, "Education details are incomplete");
  if (!application.address?.permanent)
    throw new ApiError(400, "Address details are incomplete");

  application.status = "submitted";
  application.declaration = declaration;
  application.submittedAt = new Date();
  application.currentStep = 9;
  await application.save();

  // Update job applicant count
  await Job.findByIdAndUpdate(application.jobId, {
    $inc: { totalApplicants: 1 },
  });

  // Queue confirmation email
  const candidate = await User.findById(candidateId).select("email fullName");
  await publishToQueue(QUEUES.EMAIL, {
    type: "application_submitted",
    to: candidate?.email,
    name: candidate?.fullName,
    applicationId: application.applicationId,
  });

  return application;
};

// ── Candidate: Get own applications ──────────────────────────

const getCandidateApplications = async (candidateId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = { candidateId };
  if (query.status) filter.status = query.status;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate("jobId", "title department postCode applicationDeadline")
      .select("-formResponses")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  return { applications, meta: paginationMeta(total, page, limit) };
};

const getCandidateApplicationById = async (applicationId, candidateId) => {
  const application = await Application.findOne({
    _id: applicationId,
    candidateId,
  }).populate(
    "jobId",
    "title department postCode formSections documentRequirements",
  );
  if (!application) throw new ApiError(404, "Application not found");
  return application;
};

// ── Admin: Get all applications ───────────────────────────────

const getAdminApplications = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.jobId) filter.jobId = query.jobId;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.documentStatus) filter.documentStatus = query.documentStatus;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate("candidateId", "fullName email registeredMobile category")
      .populate("jobId", "title department postCode")
      .select("-formResponses -documents")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  return { applications, meta: paginationMeta(total, page, limit) };
};

const getAdminApplicationById = async (id) => {
  const application = await Application.findById(id)
    .populate(
      "candidateId",
      "fullName email registeredMobile category profilePhoto",
    )
    .populate(
      "jobId",
      "title department postCode formSections documentRequirements",
    )
    .populate("reviewedBy", "fullName employeeId");
  if (!application) throw new ApiError(404, "Application not found");
  return application;
};

// ── Admin: Update application status ─────────────────────────

const updateApplicationStatus = async (
  id,
  status,
  reviewedBy,
  rejectionReason,
) => {
  const application = await Application.findById(id).populate(
    "candidateId",
    "email fullName",
  );
  if (!application) throw new ApiError(404, "Application not found");

  application.status = status;
  application.reviewedBy = reviewedBy;
  application.reviewedAt = new Date();
  if (rejectionReason) application.rejectionReason = rejectionReason;
  await application.save();

  // Notify candidate in real-time
  emitToCandidate(
    application.candidateId._id.toString(),
    SOCKET_EVENTS.APPLICATION_STATUS_CHANGED,
    {
      applicationId: application.applicationId,
      status,
      message: `Your application status has been updated to: ${status}`,
    },
  );

  // Queue notification email
  await publishToQueue(QUEUES.EMAIL, {
    type: "application_status_update",
    to: application.candidateId.email,
    name: application.candidateId.fullName,
    applicationId: application.applicationId,
    status,
    rejectionReason,
  });

  // Emit admin dashboard update
  emitToAdmins(SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
    applicationId: id,
    newStatus: status,
  });

  return application;
};

// ── Admin: Bulk action ────────────────────────────────────────

const bulkUpdateStatus = async (applicationIds, status, reviewedBy) => {
  const result = await Application.updateMany(
    { _id: { $in: applicationIds } },
    { status, reviewedBy, reviewedAt: new Date() },
  );

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "bulk_status_update",
    count: result.modifiedCount,
    status,
  });

  return { updated: result.modifiedCount };
};

module.exports = {
  startApplication,
  saveStep,
  submitApplication,
  getCandidateApplications,
  getCandidateApplicationById,
  getAdminApplications,
  getAdminApplicationById,
  updateApplicationStatus,
  bulkUpdateStatus,
};

