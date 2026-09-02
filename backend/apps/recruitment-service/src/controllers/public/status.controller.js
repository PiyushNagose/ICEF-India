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
const {
  emitToAdmins,
  emitToCandidate,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");
const { startOfDay, endOfDay } = require("../../shared/utils/timeline");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");

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

const formatOfficialDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getCorrectionWindowBlockMessage = (job, now = new Date()) => {
  const start = startOfDay(job?.correctionStartDate);
  const end = endOfDay(job?.correctionDeadline);
  if (!start || !end) {
    return "Correction window has not been released for this recruitment";
  }
  if (now < start) {
    return `Correction window opens on ${formatOfficialDate(start)}`;
  }
  if (now > end) {
    return `Correction window closed on ${formatOfficialDate(end)}`;
  }
  return "";
};

// ─────────────────────────────────────────────────────────────
// POST /api/public/application/status
// Check application status by registration number (OTP verified)
// ─────────────────────────────────────────────────────────────
const buildCandidateUpdates = ({
  application,
  job,
  correctionDisplayStatus,
  publishedSchedule,
  activeCorrectionRequest,
}) => {
  const updates = [];
  const addUpdate = (item) => {
    if (!item?.title) return;
    updates.push({
      type: item.type || "general",
      title: item.title,
      message: item.message || "",
      status: item.status || "info",
      date: item.date || null,
    });
  };

  addUpdate({
    type: "application",
    title: "Application submitted",
    message: `Your application for ${job?.title || "this recruitment"} has been recorded.`,
    status: "completed",
    date: application.submittedAt || application.createdAt,
  });

  if (application.paymentStatus) {
    addUpdate({
      type: "payment",
      title:
        application.paymentStatus === "paid"
          ? "Payment verified"
          : "Payment pending",
      message:
        application.paymentStatus === "paid"
          ? "Application fee has been received."
          : "Complete the payment before the configured deadline.",
      status: application.paymentStatus === "paid" ? "completed" : "pending",
      date: application.payment?.paidAt || application.updatedAt,
    });
  }

  if (application.status && application.status !== "draft") {
    addUpdate({
      type: "review",
      title: "Application review status",
      message: `Current status is ${String(application.status).replace(/_/g, " ")}.`,
      status:
        application.status === "rejected"
          ? "blocked"
          : ["approved", "shortlisted"].includes(application.status)
            ? "completed"
            : "pending",
      date: application.reviewedAt || application.updatedAt,
    });
  }

  if (application.correction && correctionDisplayStatus !== "none") {
    addUpdate({
      type: "correction",
      title:
        correctionDisplayStatus === "resolved"
          ? "Correction resolved"
          : correctionDisplayStatus === "submitted"
            ? "Correction submitted"
            : "Correction required",
      message:
        application.correction.note ||
        (correctionDisplayStatus === "resolved"
          ? "The correction request has been resolved."
          : "Open Check Status to review the fields marked by admin."),
      status: correctionDisplayStatus === "resolved" ? "completed" : "pending",
      date:
        application.correction.submittedAt ||
        application.correction.requestedAt ||
        application.updatedAt,
    });
  } else if (activeCorrectionRequest) {
    addUpdate({
      type: "correction",
      title: "Correction request recorded",
      message:
        activeCorrectionRequest.reviewComments ||
        activeCorrectionRequest.reason ||
        "Your correction request is in review.",
      status: "pending",
      date: activeCorrectionRequest.requestedAt,
    });
  }

  if (job?.admitCardReleaseDate) {
    const released =
      publishedSchedule &&
      startOfDay(job.admitCardReleaseDate) <= startOfDay(new Date());
    addUpdate({
      type: "admit_card",
      title: released ? "Admit card available" : "Admit card scheduled",
      message: released
        ? "Use the Admit Card page with your registration number and mobile."
        : "Admit card will be available after the official release date.",
      status: released ? "completed" : "pending",
      date: job.admitCardReleaseDate,
    });
  }

  if (job?.resultDate) {
    const released = startOfDay(job.resultDate) <= startOfDay(new Date());
    addUpdate({
      type: "result",
      title: released ? "Result window active" : "Result scheduled",
      message: released
        ? "Check result updates from the project recruitment page."
        : "Result will be available after the official publish date.",
      status: released ? "completed" : "pending",
      date: job.resultDate,
    });
  }

  return updates
    .filter((item) => item.date || item.type === "review")
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

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
    .populate({
      path: "jobId",
      select:
        "title department postCode examDate admitCardReleaseDate resultDate applicationDeadline correctionStartDate correctionDeadline projectId",
      populate: { path: "projectId", select: "name publicSlug department state" },
    })
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
  const admitCardAvailable =
    Boolean(publishedSchedule) &&
    (!job?.admitCardReleaseDate ||
      startOfDay(job.admitCardReleaseDate) <= startOfDay(now));
  const resultAvailable =
    Boolean(job?.resultDate) && startOfDay(job.resultDate) <= startOfDay(now);
  const correctionDisplayStatus = getCorrectionDisplayStatus(
    application.correction,
  );
  const latestCorrectionRequest = [...(application.corrections || [])].sort(
    (a, b) =>
      new Date(b.requestedAt || 0).getTime() -
      new Date(a.requestedAt || 0).getTime(),
  )[0];
  const activeCorrectionRequest = [...(application.corrections || [])]
    .filter((c) =>
      ["pending", "more_info_needed"].includes(c.status),
    )
    .sort(
      (a, b) =>
        new Date(b.requestedAt || 0).getTime() -
        new Date(a.requestedAt || 0).getTime(),
    )[0];
  const updates = buildCandidateUpdates({
    application,
    job,
    correctionDisplayStatus,
    publishedSchedule,
    activeCorrectionRequest,
  });

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
            projectSlug: job.projectId?.publicSlug,
          }
        : null,
      correctionWindow: {
        isOpen:
          job?.correctionStartDate &&
          job?.correctionDeadline &&
          startOfDay(job.correctionStartDate) <= startOfDay(now) &&
          endOfDay(job.correctionDeadline) >= now,
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
      updates,
      admitCardAvailable,
      resultAvailable,
      hasExistingCorrection:
        Boolean(latestCorrectionRequest),
      activeCorrectionRequest: latestCorrectionRequest
        ? {
            requestId: latestCorrectionRequest.requestId,
            status: latestCorrectionRequest.status,
            requestedAt: latestCorrectionRequest.requestedAt,
            reviewedAt: latestCorrectionRequest.reviewedAt,
            reviewComments: latestCorrectionRequest.reviewComments,
            requestedFields: latestCorrectionRequest.requestedFields || [],
            reason: latestCorrectionRequest.reason,
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
    .populate({
      path: "jobId",
      select:
        "title department postCode applicationDeadline correctionStartDate correctionDeadline projectId",
    })
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
  const correctionStartDate = job?.correctionStartDate;
  const correctionDeadline = job?.correctionDeadline;
  const windowOpen =
    correctionStartDate &&
    correctionDeadline &&
    startOfDay(correctionStartDate) <= startOfDay(now) &&
    endOfDay(correctionDeadline) >= now;

  if (!windowOpen) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      getCorrectionWindowBlockMessage(job, now),
    );
  }

  // Public correction is one request per submitted application unless admin
  // opens a fresh clarification cycle for specific fields.
  const hasAdminMarkedSubmission =
    ["requested", "in_progress"].includes(application.correction?.status) &&
    corrections.some((c) => c.adminIssueId);
  const existingPublicRequest = application.corrections
    ?.filter((c) =>
      hasAdminMarkedSubmission
        ? ["pending", "more_info_needed"].includes(c.status)
        : true,
    )
    .sort(
      (a, b) =>
        new Date(b.requestedAt || 0).getTime() -
        new Date(a.requestedAt || 0).getTime(),
    )[0];
  if (existingPublicRequest) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `A correction request (${existingPublicRequest.requestId}) already exists for this application`,
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
  application.status = "under_review";

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

  const correctionPayload = {
    applicationId: application._id,
    publicApplicationId: application.applicationId,
    registrationNumber: application.registrationNumber,
    requestId,
    ticketId: ticket._id,
    status: "pending",
    timestamp: new Date(),
  };
  try {
    emitToAdmins(SOCKET_EVENTS.CORRECTION_SUBMITTED, correctionPayload);
    if (application.candidateId?._id) {
      emitToCandidate(
        application.candidateId._id,
        SOCKET_EVENTS.CORRECTION_SUBMITTED,
        correctionPayload,
      );
    }
  } catch {
    // Socket.IO may not be initialized in test/CLI contexts.
  }

  await notifyAdmins({
    type: "application_correction",
    title: "Correction Request Submitted",
    message: `${application.personalDetails?.fullName || application.candidateId?.fullName || "Candidate"} submitted a correction request for ${application.applicationId} (${application.jobId?.title || "recruitment"}).`,
    link: `/admin/support/ticket/${ticket._id}`,
    metadata: {
      applicationId: application.applicationId,
      registrationNumber: application.registrationNumber,
      requestId,
      ticketId: ticket.ticketId,
      supportTicketId: String(ticket._id),
    },
  });

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
