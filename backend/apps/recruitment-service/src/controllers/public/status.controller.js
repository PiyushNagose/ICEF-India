const { StatusCodes } = require("http-status-codes");
const Application = require("../../shared/models/Application");
const ExamSchedule = require("../../shared/models/ExamSchedule");
const SupportTicket = require("../../shared/models/SupportTicket");
const User = require("../../shared/models/User");
const ApiError = require("../../shared/utils/ApiError");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const crypto = require("crypto");
const {
  normalizeOtpIdentifier,
  assertOTPVerified,
} = require("../../shared/utils/publicOtp");

const getCorrectionDisplayStatus = (correction) => {
  if (!correction || correction.status === "none") {
    return correction?.status || "none";
  }
  if (correction.status === "resolved") return "resolved";
  const issues = correction.issues || [];
  if (
    correction.status === "submitted" &&
    issues.length > 0 &&
    issues.every((issue) => issue.status === "resolved")
  ) {
    return "resolved";
  }
  return correction.status;
};

// ─────────────────────────────────────────────────────────────
// POST /api/public/application/status
// Check application status by registration number (OTP verified)
// ─────────────────────────────────────────────────────────────
exports.checkStatus = asyncHandler(async (req, res) => {
  const { registrationNumber, dateOfBirth } = req.body;
  const mobile = normalizeOtpIdentifier(req.body.mobile, "mobile");

  if (!registrationNumber || !mobile) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Registration number and mobile are required",
    );
  }

  // Verify mobile OTP
  await assertOTPVerified(mobile, "mobile");

  // Find application
  const application = await Application.findOne({ registrationNumber })
    .populate(
      "jobId",
      "title department postCode examDate admitCardReleaseDate resultDate applicationDeadline correctionStartDate correctionDeadline",
    )
    .populate("candidateId", "email registeredMobile dateOfBirth")
    .lean();

  if (!application) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No application found with this registration number",
    );
  }

  // Verify mobile matches
  const storedMobile = normalizeOtpIdentifier(
    application.candidateId?.registeredMobile || application.contactMobile,
    "mobile",
  );
  if (storedMobile && storedMobile !== mobile) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Mobile number does not match our records",
    );
  }

  // Optionally verify DOB
  if (dateOfBirth && application.personalDetails?.dateOfBirth) {
    const storedDOB = new Date(application.personalDetails.dateOfBirth)
      .toISOString()
      .split("T")[0];
    if (storedDOB !== dateOfBirth) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Date of birth does not match our records",
      );
    }
  }

  const job = application.jobId;
  const publishedSchedule = job
    ? await ExamSchedule.exists({ jobId: job._id, status: "published" })
    : null;
  const now = new Date();
  const correctionDisplayStatus = getCorrectionDisplayStatus(
    application.correction,
  );
  const activeCorrectionRequest = [...(application.corrections || [])]
    .filter((c) => ["pending", "more_info_needed"].includes(c.status))
    .sort(
      (a, b) =>
        new Date(b.requestedAt || 0).getTime() -
        new Date(a.requestedAt || 0).getTime(),
    )[0];

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application status fetched", {
      registrationNumber: application.registrationNumber,
      applicationId: application.applicationId,
      applicantName: application.personalDetails?.fullName,
      status: application.status,
      paymentStatus: application.paymentStatus,
      totalFee: application.totalFee,
      appliedPosts: application.appliedPosts?.map((p) => ({
        title: p.title,
        postCode: p.postCode,
        department: p.department,
      })),
      submittedAt: application.submittedAt,
      jobDetails: job
        ? {
            title: job.title,
            department: job.department,
            postCode: job.postCode,
            examDate: job.examDate,
            admitCardDate: job.admitCardReleaseDate,
            resultDate: job.resultDate,
            applicationDeadline: job.applicationDeadline,
          }
        : null,
      correctionWindow: {
        isOpen:
          job?.correctionStartDate &&
          job?.correctionDeadline &&
          job.correctionStartDate <= now &&
          job.correctionDeadline >= now,
        startDate: job?.correctionStartDate,
        endDate: job?.correctionDeadline,
      },
      correction: application.correction
        ? {
            status: correctionDisplayStatus,
            note: application.correction.note,
            requestedAt: application.correction.requestedAt,
            submittedAt: application.correction.submittedAt,
            issues: (application.correction.issues || []).map((issue) => ({
              id: String(issue._id || issue.fieldKey),
              section: issue.section,
              fieldKey: issue.fieldKey,
              fieldLabel: issue.fieldLabel,
              issueType: issue.issueType,
              currentValue: issue.currentValue,
              remark: issue.remark,
              status: issue.status,
            })),
          }
        : null,
      admitCardAvailable: Boolean(publishedSchedule),
      hasExistingCorrection:
        Boolean(activeCorrectionRequest),
      activeCorrectionRequest: activeCorrectionRequest
        ? {
            requestId: activeCorrectionRequest.requestId,
            status: activeCorrectionRequest.status,
            requestedAt: activeCorrectionRequest.requestedAt,
            reviewedAt: activeCorrectionRequest.reviewedAt,
            reviewComments: activeCorrectionRequest.reviewComments,
            requestedFields: activeCorrectionRequest.requestedFields || [],
            reason: activeCorrectionRequest.reason,
          }
        : null,
    }),
  );
});

// ─────────────────────────────────────────────────────────────
// POST /api/public/application/request-correction
// Submit correction request during correction window
// ─────────────────────────────────────────────────────────────
exports.requestCorrection = asyncHandler(async (req, res) => {
  const {
    registrationNumber,
    corrections, // array of { field, oldValue, newValue, reason }
    overallReason,
  } = req.body;
  const mobile = normalizeOtpIdentifier(req.body.mobile, "mobile");

  if (!registrationNumber || !mobile) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Registration number and mobile are required",
    );
  }
  if (!corrections?.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "At least one correction is required",
    );
  }

  // Verify mobile OTP
  await assertOTPVerified(mobile, "mobile");

  // Find application
  const application = await Application.findOne({ registrationNumber })
    .populate(
      "jobId",
      "title department postCode correctionStartDate correctionDeadline applicationDeadline",
    )
    .populate("candidateId", "fullName email registeredMobile _id");

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  // Verify mobile
  const storedMobile = normalizeOtpIdentifier(
    application.candidateId?.registeredMobile || application.contactMobile,
    "mobile",
  );
  if (storedMobile && storedMobile !== mobile) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Mobile does not match");
  }

  if (application.paymentStatus !== "paid" || application.status === "draft") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Correction can be requested only for a submitted paid application",
    );
  }

  // Check correction window
  const now = new Date();
  const job = application.jobId;
  const windowOpen =
    job?.correctionStartDate &&
    job?.correctionDeadline &&
    job.correctionStartDate <= now &&
    job.correctionDeadline >= now;

  if (!windowOpen) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      job?.correctionStartDate
        ? `Correction window is closed. It was open from ${job.correctionStartDate.toDateString()} to ${job.correctionDeadline.toDateString()}`
        : "No correction window is configured for this recruitment",
    );
  }

  // Public correction is one request per submitted application unless admin
  // opens a fresh clarification cycle for specific fields.
  const hasAdminMarkedSubmission =
    ["requested", "in_progress"].includes(application.correction?.status) &&
    corrections.some((c) => c.adminIssueId);
  const existingPending = application.corrections?.find((c) =>
    ["pending", "more_info_needed"].includes(c.status) ||
    (!hasAdminMarkedSubmission && c.status === "approved"),
  );
  if (existingPending) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `A correction request (${existingPending.requestId}) already exists for this application`,
    );
  }

  // Build correction entry
  const requestId = `CORR-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const correctionEntry = {
    requestId,
    requestedAt: now,
    requestedFields: corrections.map((c) => ({
      field: c.field,
      fieldLabel: c.fieldLabel,
      adminIssueId: c.adminIssueId,
      oldValue: String(c.oldValue || ""),
      newValue: String(c.newValue || ""),
      supportingDocument: c.supportingDocumentUrl || "",
      reason: c.reason,
    })),
    reason: overallReason || corrections.map((c) => c.reason).join("; "),
    status: "pending",
  };

  application.corrections.push(correctionEntry);

  // Keep admin-marked correction issues attached to this exact application.
  const existingIssues = application.correction?.issues || [];
  if (!application.correction) {
    application.correction = {};
  }
  application.correction.status = "submitted";
  application.correction.submittedAt = now;
  application.correction.note = overallReason || application.correction.note;
  application.correction.issues = existingIssues.map((issue) => {
    const issueId = String(issue._id || issue.fieldKey);
    const matched = corrections.find((c) => c.adminIssueId === issueId);
    if (!matched) return issue;
    issue.status = "resolved";
    issue.resolvedAt = now;
    return issue;
  });

  await application.save();

  // Create support ticket
  const ticketId = `TKT-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const ticket = await SupportTicket.create({
    ticketId,
    title: `Correction Request — ${application.personalDetails?.fullName || registrationNumber}`,
    description: `Registration: ${registrationNumber}\n\nRequested Changes:\n${corrections
      .map(
        (c) => `• ${c.field}: "${c.oldValue}" → "${c.newValue}" (${c.reason})`,
      )
      .join("\n")}`,
    category: "Application",
    priority: "High",
    status: "Open",
    raisedBy: application.candidateId._id,
    raisedByEmail: application.contactEmail,
  });

  ticket.title = `Correction Request - ${application.applicationId}`;
  ticket.description = `Application ID: ${application.applicationId}\nRegistration Number: ${registrationNumber}\nCandidate: ${application.personalDetails?.fullName || application.candidateId?.fullName || "Not provided"}\nJob: ${application.jobId?.title || "Not linked"}\n\nRequested Changes:\n${corrections
    .map(
      (c) =>
        `- ${c.field}: "${c.oldValue || "not provided"}" -> "${c.newValue}" (${c.reason})`,
    )
    .join("\n")}`;
  ticket.source = "web";
  ticket.guestContact = {
    name: application.personalDetails?.fullName || application.candidateId?.fullName,
    email: application.contactEmail || application.candidateId?.email,
    mobile: application.contactMobile || application.candidateId?.registeredMobile,
  };
  ticket.registrationNumber = registrationNumber;
  ticket.linkedApplication = application._id;
  ticket.resolutionAction = {
    type: "application_correction",
    status: "requested",
    requestedAt: now,
    note: overallReason || undefined,
  };
  ticket.raisedBy = application.candidateId?._id;
  ticket.raisedByEmail = application.contactEmail || application.candidateId?.email;
  ticket.sla = {
    firstResponseDueAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    resolutionDueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
  };
  await ticket.save();

  // Link ticket to correction
  application.corrections[application.corrections.length - 1].supportTicketId =
    ticket._id;
  application.correction.supportTicket = ticket._id;
  await application.save();

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(
      StatusCodes.CREATED,
      "Correction request submitted successfully",
      {
        requestId,
        ticketId,
        status: "pending",
        registrationNumber: application.registrationNumber,
        applicationId: application.applicationId,
        jobTitle: application.jobId?.title,
        message:
          "Your correction request has been submitted. You will be notified once reviewed.",
        estimatedResolutionTime: "48 hours",
      },
    ),
  );
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/application/correction-status/:requestId
// Check status of a correction request
// ─────────────────────────────────────────────────────────────
exports.getCorrectionStatus = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { registrationNumber } = req.query;

  if (!registrationNumber) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Registration number required");
  }

  const application = await Application.findOne({ registrationNumber }).lean();
  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  const correction = application.corrections?.find(
    (c) => c.requestId === requestId,
  );
  if (!correction) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Correction request not found");
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Correction request status", {
      requestId: correction.requestId,
      status: correction.status,
      requestedAt: correction.requestedAt,
      reviewedAt: correction.reviewedAt,
      reviewComments: correction.reviewComments,
      requestedFields: correction.requestedFields,
    }),
  );
});
