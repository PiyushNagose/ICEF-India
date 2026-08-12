const { StatusCodes } = require("http-status-codes");
const Application = require("../../shared/models/Application");
const Job = require("../../shared/models/Job");
const User = require("../../shared/models/User");
const ApiError = require("../../shared/utils/ApiError");
const {
  ApiResponse,
  paginationMeta,
} = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  emitToAdmins,
  emitToCandidate,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");
const { getPaginationParams } = require("../../shared/utils/helpers");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const { notify } = require("../../shared/utils/notify");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");
const {
  buildExportContent,
  buildGovernmentBundle,
  writeExportFile,
} = require("../../shared/services/applicationExport.service");
const {
  applyFileStorageMetadata,
} = require("../../shared/services/fileStorage.service");

const getApplicationCandidateName = (application) =>
  application?.personalDetails?.fullName ||
  application?.candidateId?.fullName ||
  application?.candidate?.fullName ||
  "Candidate";

const REVIEW_STATUSES = new Set([
  "clarification_required",
]);

const sanitizeCorrectionIssues = (issues = []) =>
  (Array.isArray(issues) ? issues : [])
    .map((issue) => ({
      section: String(issue.section || "").trim(),
      fieldKey: String(issue.fieldKey || "").trim(),
      fieldLabel: String(issue.fieldLabel || "").trim(),
      issueType: String(issue.issueType || "").trim(),
      currentValue:
        issue.currentValue === undefined || issue.currentValue === null
          ? ""
          : String(issue.currentValue).trim(),
      remark: String(issue.remark || "").trim(),
      status: "pending",
      requestedAt: new Date(),
    }))
    .filter(
      (issue) =>
        issue.section &&
        issue.fieldKey &&
        issue.fieldLabel &&
        issue.issueType &&
        issue.remark,
    );

const setCorrectedApplicationValue = (application, field, value) => {
  const allowedPrefixes = [
    "personalDetails.",
    "education.",
    "additionalInfo.",
    "address.",
    "formResponses.",
  ];

  if (!allowedPrefixes.some((prefix) => field.startsWith(prefix))) {
    return false;
  }

  const keys = field.split(".").filter(Boolean);
  if (keys.length < 2) return false;

  let target = application;
  keys.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== "object") {
      target[key] = {};
    }
    target = target[key];
  });
  target[keys[keys.length - 1]] = value;
  return true;
};

const getRequiredDocumentIssues = (application) => {
  const requiredDocuments = Array.isArray(application.jobId?.documentRequirements)
    ? application.jobId.documentRequirements.filter((doc) => doc.required !== false)
    : [];
  const uploadedDocuments = Array.isArray(application.documents)
    ? application.documents
    : [];

  if (requiredDocuments.length === 0) {
    const uploadedRequired = uploadedDocuments.filter((doc) => doc.required !== false);
    return uploadedRequired
      .filter((doc) => doc.status !== "verified")
      .map((doc) => `${doc.name || doc.type || "Document"} is ${doc.status || "pending"}`);
  }

  return requiredDocuments.flatMap((requirement) => {
    const requiredType = requirement.type || requirement.id || requirement.name;
    const uploaded = uploadedDocuments.find(
      (doc) =>
        doc.type === requiredType ||
        doc.name === requirement.name ||
        doc.name === requiredType,
    );

    if (!uploaded) {
      return [`${requirement.name || requiredType || "Required document"} is missing`];
    }

    if (uploaded.status !== "verified") {
      return [
        `${uploaded.name || requirement.name || uploaded.type || "Required document"} is ${uploaded.status || "pending"}`,
      ];
    }

    return [];
  });
};

const buildExportFilter = (query = {}) => {
  const filter = {};
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.paymentStatus && query.paymentStatus !== "all") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.documentStatus && query.documentStatus !== "all") {
    filter.documentStatus = query.documentStatus;
  }
  if (query.jobId) filter.jobId = query.jobId;
  if (query.search) {
    const searchRegex = new RegExp(String(query.search).trim(), "i");
    filter.$or = [
      { applicationId: searchRegex },
      { registrationNumber: searchRegex },
      { contactEmail: searchRegex },
      { contactMobile: searchRegex },
      { "personalDetails.fullName": searchRegex },
      { "personalDetails.registeredMobile": searchRegex },
    ];
  }
  return filter;
};

const loadExportApplications = async (query = {}) => {
  const filter = buildExportFilter(query);
  const limit = Math.min(Number(query.limit || 50000), 100000);
  const applications = await Application.find(filter)
    .sort({ submittedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate("candidateId", "fullName email registeredMobile category")
    .populate({
      path: "jobId",
      select: "title postCode department projectId",
      populate: { path: "projectId", select: "name publicSlug" },
    })
    .lean();

  return applications;
};

const normalizeExportType = (type) => {
  const allowed = new Set([
    "register",
    "documents",
    "payments",
    "corrections",
    "bundle",
    "print",
  ]);
  return allowed.has(type) ? type : "register";
};

const sendExportFile = (res, file) => {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename}"`,
  );
  return res.sendFile(file.filePath);
};

const exportApplications = asyncHandler(async (req, res) => {
  const type = normalizeExportType(req.params.type);
  const applications = await loadExportApplications(req.query);

  if (type === "bundle") {
    const bundle = await buildGovernmentBundle(applications);
    await saveAuditLog(
      req,
      `Exported government handover bundle for ${applications.length} applications`,
    );
    return sendExportFile(res, bundle);
  }

  const content = buildExportContent(type, applications);
  const isPrintableRegister = type === "print";
  const file = await writeExportFile({
    filename: `application-${type}-${Date.now()}.${
      isPrintableRegister ? "html" : "csv"
    }`,
    content,
    contentType: isPrintableRegister
      ? "text/html; charset=utf-8"
      : "text/csv; charset=utf-8",
  });

  await saveAuditLog(
    req,
    `Exported application ${type} register for ${applications.length} applications`,
  );

  return sendExportFile(res, file);
});

const repairStorageManifests = asyncHandler(async (req, res) => {
  const filter = buildExportFilter(req.query);
  const limit = Math.min(Number(req.query.limit || 5000), 20000);
  const applications = await Application.find(filter)
    .sort({ submittedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate({
      path: "jobId",
      select: "title postCode department projectId",
      populate: { path: "projectId", select: "name publicSlug" },
    });

  let updatedCount = 0;
  for (const application of applications) {
    applyFileStorageMetadata(application, {
      job: application.jobId,
      project: application.jobId?.projectId,
    });
    await application.save();
    updatedCount += 1;
  }

  await saveAuditLog(
    req,
    `Repaired storage manifests for ${updatedCount} applications`,
  );

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Storage manifests repaired", {
      updatedCount,
    }),
  );
});

const assertReviewTransitionAllowed = (application, status, reason, issues = []) => {
  if (!REVIEW_STATUSES.has(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid application status");
  }

  if (status === "clarification_required" && !reason?.trim()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Clarification note is required",
    );
  }

  if (status === "clarification_required" && issues.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Select at least one field or document issue for correction",
    );
  }
};

/**
 * @desc    Get all applications with filters
 * @route   GET /api/admin/applications
 * @access  Private (Admin)
 */
const getApplications = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    paymentStatus,
    documentStatus,
    jobId,
    department,
    search,
    sortBy = "submittedAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter
  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (documentStatus) filter.documentStatus = documentStatus;
  if (jobId) filter.jobId = jobId;

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Build aggregation pipeline
  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: "jobs",
        localField: "jobId",
        foreignField: "_id",
        as: "job",
      },
    },
    { $unwind: "$job" },
    {
      $lookup: {
        from: "users",
        localField: "candidateId",
        foreignField: "_id",
        as: "candidate",
      },
    },
    { $unwind: { path: "$candidate", preserveNullAndEmptyArrays: true } },
  ];

  // Add department filter if specified
  if (department) {
    pipeline.push({
      $match: { "job.department": new RegExp(department, "i") },
    });
  }

  // Add search filter if specified
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { applicationId: new RegExp(search, "i") },
          { registrationNumber: new RegExp(search, "i") },
          { contactEmail: new RegExp(search, "i") },
          { contactMobile: new RegExp(search, "i") },
          { "personalDetails.fullName": new RegExp(search, "i") },
          { "personalDetails.registeredMobile": new RegExp(search, "i") },
          { "candidate.fullName": new RegExp(search, "i") },
          { "candidate.email": new RegExp(search, "i") },
          { "job.title": new RegExp(search, "i") },
        ],
      },
    });
  }

  // Add sorting
  pipeline.push({ $sort: sort });

  // Get total count
  const totalPipeline = [...pipeline, { $count: "total" }];
  const totalResult = await Application.aggregate(totalPipeline);
  const total = totalResult[0]?.total || 0;

  // Add pagination
  const skip = (page - 1) * limit;
  pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

  // Add projection to select required fields
  pipeline.push({
    $project: {
      applicationId: 1,
      registrationNumber: 1,
      isPublicApplication: 1,
      contactEmail: 1,
      contactMobile: 1,
      status: 1,
      paymentStatus: 1,
      transactionId: 1,
      documentStatus: 1,
      totalFee: 1,
      personalDetails: 1,
      submittedAt: 1,
      createdAt: 1,
      "job.title": 1,
      "job.department": 1,
      "job.postCode": 1,
      "candidate.fullName": 1,
      "candidate.email": 1,
      "candidate.registeredMobile": 1,
      "candidate.category": 1,
    },
  });

  const applications = await Application.aggregate(pipeline);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Applications fetched successfully", {
      applications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    }),
  );
});

/**
 * @desc    Get single application with full details
 * @route   GET /api/admin/applications/:id
 * @access  Private (Admin)
 */
const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate("candidateId", "-password -otp -otpExpiry -refreshToken")
    .populate("jobId")
    .populate("reviewedBy", "fullName employeeId");

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application fetched successfully", {
      application,
    }),
  );
});

/**
 * @desc    Update application status
 * @route   PUT /api/admin/applications/:id/status
 * @access  Private (Admin)
 */
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason, notes } = req.body;
  const reviewReason = rejectionReason || notes || "";
  const correctionIssues = sanitizeCorrectionIssues(req.body.correctionIssues);
  const applicationId = req.params.id;

  const application = await Application.findById(applicationId)
    .populate("candidateId", "fullName email")
    .populate("jobId", "title documentRequirements");

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  assertReviewTransitionAllowed(application, status, reviewReason, correctionIssues);

  const oldStatus = application.status;
  application.status = status;
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();

  if (status === "rejected") {
    application.rejectionReason = reviewReason;
  } else if (status !== "rejected") {
    application.rejectionReason = undefined;
  }

  if (status === "clarification_required") {
    application.correction.status = "requested";
    application.correction.requestedBy = req.user.id;
    application.correction.requestedAt = new Date();
    application.correction.note = reviewReason;
    application.correction.issues = correctionIssues;
  }

  if (["verified", "approved"].includes(status)) {
    application.correction.status = "none";
    application.correction.note = undefined;
    application.correction.issues = [];
  }

  await application.save();
  const candidateName = getApplicationCandidateName(application);

  // Persist notification in DB + real-time push
  const notifType =
    status === "verified" || status === "approved"
      ? "application_approved"
      : status === "rejected"
        ? "application_rejected"
        : status === "clarification_required"
          ? "application_correction"
        : "general";

  const notifTitle =
    status === "verified" || status === "approved"
      ? "Application Verified"
      : status === "rejected"
        ? "Application Rejected"
        : status === "clarification_required"
          ? "Clarification Required"
        : "Application Status Updated";

  const notifMessage =
    status === "rejected" && reviewReason
      ? `Your application ${application.applicationId} was rejected. Reason: ${reviewReason}`
      : status === "clarification_required"
        ? `Clarification is required for application ${application.applicationId}. ${reviewReason}`
      : `Your application ${application.applicationId} for ${application.jobId?.title || "the job"} has been ${status}.`;

  await notify({
    recipientId: application.candidateId._id,
    type: notifType,
    title: notifTitle,
    message: notifMessage,
    link: `/candidate/applications`,
    metadata: { applicationId: application.applicationId, status },
  });

  // Notify all admins about the status change
  notifyAdmins({
    type: "application_submitted",
    title: `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: `${candidateName}'s application ${application.applicationId} for "${application.jobId?.title}" has been ${status}.`,
    link: `/admin/applications/${application._id}`,
    metadata: { applicationId: application.applicationId, status },
  });

  // Real-time socket to admins
  emitToAdmins(SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
    type: "application_status_changed",
    message: `Application ${application.applicationId} status changed from ${oldStatus} to ${status}`,
    application: {
      _id: application._id,
      applicationId: application.applicationId,
      candidateName,
      jobTitle: application.jobId.title,
      oldStatus,
      newStatus: status,
    },
    timestamp: new Date(),
  });

  // Notify candidate
  emitToCandidate(
    application.candidateId._id,
    SOCKET_EVENTS.APPLICATION_STATUS_CHANGED,
    {
      type: "status_update",
      message: `Your application status has been updated to: ${status}`,
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        status,
        rejectionReason: reviewReason,
      },
      timestamp: new Date(),
    },
  );

  if (status === "clarification_required") {
    const correctionPayload = {
      applicationId: application._id,
      publicApplicationId: application.applicationId,
      registrationNumber: application.registrationNumber,
      status: application.correction?.status,
      issues: application.correction?.issues || [],
      timestamp: new Date(),
    };
    emitToAdmins(SOCKET_EVENTS.CORRECTION_REQUESTED, correctionPayload);
    emitToCandidate(
      application.candidateId._id,
      SOCKET_EVENTS.CORRECTION_REQUESTED,
      correctionPayload,
    );
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application status updated successfully", {
      message: "Application status updated successfully",
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        status: application.status,
        reviewedBy: application.reviewedBy,
        reviewedAt: application.reviewedAt,
        rejectionReason: application.rejectionReason,
        correction: application.correction,
      },
    }),
  );
});

const reviewCorrection = asyncHandler(async (req, res) => {
  const { action, notes = "" } = req.body;
  const application = await Application.findById(req.params.id)
    .populate("candidateId", "fullName email")
    .populate("jobId", "title");

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  const correction = [...(application.corrections || [])]
    .reverse()
    .find((item) => item.status === "pending");

  if (!correction) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No submitted correction request is pending review",
    );
  }

  const now = new Date();

  if (action === "approve") {
    const appliedFields = [];

    (correction.requestedFields || []).forEach((fieldCorrection) => {
      const applied = setCorrectedApplicationValue(
        application,
        fieldCorrection.field,
        fieldCorrection.newValue,
      );
      if (applied) {
        appliedFields.push(fieldCorrection.field);
      }
    });

    correction.status = "approved";
    correction.reviewedBy = req.user.id;
    correction.reviewedAt = now;
    correction.reviewComments =
      notes ||
      `Correction accepted. Applied ${appliedFields.length} field update(s).`;

    application.status = "approved";
    application.reviewedBy = req.user.id;
    application.reviewedAt = now;
    application.rejectionReason = undefined;
    application.correction.status = "resolved";
    application.correction.note =
      notes || "Candidate correction accepted by reviewer.";
    application.correction.submittedAt = application.correction.submittedAt || now;
    application.correction.issues = (application.correction.issues || []).map(
      (issue) => {
        issue.status = "resolved";
        issue.resolvedAt = issue.resolvedAt || now;
        return issue;
      },
    );
  } else {
    correction.status = "rejected";
    correction.reviewedBy = req.user.id;
    correction.reviewedAt = now;
    correction.reviewComments =
      notes || "Correction details are still not acceptable. Please resubmit.";

    application.status = "clarification_required";
    application.reviewedBy = req.user.id;
    application.reviewedAt = now;
    application.correction.status = "requested";
    application.correction.requestedBy = req.user.id;
    application.correction.requestedAt = now;
    application.correction.note = correction.reviewComments;
    application.correction.issues = (application.correction.issues || []).map(
      (issue) => {
        issue.status = "pending";
        issue.resolvedAt = undefined;
        return issue;
      },
    );
  }

  await application.save();

  await saveAuditLog(
    req,
    `${
      action === "approve" ? "Approved correction" : "Requested correction again"
    } for ${application.registrationNumber || application.applicationId} (${
      correction.requestId
    })${notes ? `: ${notes}` : ""}`,
  );

  const correctionReviewPayload = {
    applicationId: application._id,
    publicApplicationId: application.applicationId,
    registrationNumber: application.registrationNumber,
    requestId: correction.requestId,
    status: correction.status,
    applicationStatus: application.status,
    timestamp: new Date(),
  };
  emitToAdmins(SOCKET_EVENTS.CORRECTION_REVIEWED, correctionReviewPayload);
  if (application.candidateId?._id) {
    emitToCandidate(
      application.candidateId._id,
      SOCKET_EVENTS.CORRECTION_REVIEWED,
      correctionReviewPayload,
    );
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Correction review saved successfully", {
      application,
    }),
  );
});

/**
 * @desc    Bulk update application status
 * @route   POST /api/admin/applications/bulk-action
 * @access  Private (Admin)
 */
const bulkUpdateApplications = asyncHandler(async (req, res) => {
  const { applicationIds, action, status, rejectionReason, notes } = req.body;
  const reviewReason = rejectionReason || notes || "";

  if (
    !applicationIds ||
    !Array.isArray(applicationIds) ||
    applicationIds.length === 0
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Application IDs are required");
  }

  const applications = await Application.find({
    _id: { $in: applicationIds },
  })
    .populate("candidateId", "fullName email")
    .populate("jobId", "title documentRequirements");

  if (applications.length === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No applications found");
  }

  if (action !== "update_status") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid bulk action");
  }

  applications.forEach((application) => {
    assertReviewTransitionAllowed(application, status, reviewReason);
  });

  const updateData = {
    $set: {
      status,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    },
  };

  if (status === "rejected") {
    updateData.$set.rejectionReason = reviewReason;
  } else {
    updateData.$unset = { rejectionReason: "" };
  }

  if (status === "clarification_required") {
    updateData.$set.correction = {
      status: "requested",
      requestedBy: req.user.id,
      requestedAt: new Date(),
      note: reviewReason,
    };
  }

  if (["verified", "approved"].includes(status)) {
    updateData.$set["correction.status"] = "none";
    updateData.$unset = {
      ...(updateData.$unset || {}),
      "correction.note": "",
    };
  }

  // Update all applications
  await Application.updateMany({ _id: { $in: applicationIds } }, updateData);

  // Send real-time notifications
  applications.forEach((application) => {
    const candidateName = getApplicationCandidateName(application);
    // Notify admins
    emitToAdmins(SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
      type: "bulk_application_update",
      message: `Application ${application.applicationId} updated via bulk action`,
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        candidateName,
        jobTitle: application.jobId.title,
        newStatus: status,
      },
      timestamp: new Date(),
    });

    // Notify candidates
    emitToCandidate(
      application.candidateId._id,
      SOCKET_EVENTS.APPLICATION_STATUS_CHANGED,
      {
        type: "status_update",
        message: `Your application status has been updated to: ${status}`,
        application: {
          _id: application._id,
          applicationId: application.applicationId,
          status,
          rejectionReason,
        },
        timestamp: new Date(),
      },
    );
    if (status === "clarification_required") {
      const correctionPayload = {
        applicationId: application._id,
        publicApplicationId: application.applicationId,
        registrationNumber: application.registrationNumber,
        status: "requested",
        timestamp: new Date(),
      };
      emitToAdmins(SOCKET_EVENTS.CORRECTION_REQUESTED, correctionPayload);
      emitToCandidate(
        application.candidateId._id,
        SOCKET_EVENTS.CORRECTION_REQUESTED,
        correctionPayload,
      );
    }
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(
      StatusCodes.OK,
      `${applications.length} applications updated successfully`,
      {
        message: `${applications.length} applications updated successfully`,
        updatedCount: applications.length,
      },
    ),
  );
});

/**
 * @desc    Verify application document
 * @route   PUT /api/admin/applications/:id/documents/:documentId/verify
 * @access  Private (Admin)
 */
const verifyDocument = asyncHandler(async (req, res) => {
  const { id: applicationId, documentId } = req.params;

  const application = await Application.findById(applicationId).populate(
    "candidateId",
    "fullName email",
  );

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  const document = application.documents.id(documentId);
  if (!document) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Document not found");
  }

  document.status = "verified";
  document.verifiedBy = req.user.id;
  document.verifiedAt = new Date();

  await application.save();
  const candidateName = getApplicationCandidateName(application);

  // Check if all required documents are verified
  const requiredDocs = application.documents.filter(
    (doc) => doc.required !== false,
  );
  const verifiedDocs = requiredDocs.filter((doc) => doc.status === "verified");

  if (verifiedDocs.length === requiredDocs.length) {
    application.documentStatus = "complete";
    await application.save();
  }

  // Real-time notifications
  emitToAdmins(SOCKET_EVENTS.DOCUMENT_VERIFIED, {
    type: "document_verified",
    message: `Document verified for application ${application.applicationId}`,
    application: {
      _id: application._id,
      applicationId: application.applicationId,
      candidateName,
      documentType: document.type,
    },
    timestamp: new Date(),
  });

  emitToCandidate(
    application.candidateId._id,
    SOCKET_EVENTS.DOCUMENT_VERIFIED,
    {
      type: "document_verified",
      message: `Your ${document.type} document has been verified`,
      document: {
        type: document.type,
        status: document.status,
      },
      timestamp: new Date(),
    },
  );

  // Persist notification
  await notify({
    recipientId: application.candidateId._id,
    type: "document_verified",
    title: "Document Verified",
    message: `Your ${document.type.replace(/_/g, " ")} has been verified for application ${application.applicationId}.`,
    link: `/candidate/applications`,
    metadata: {
      applicationId: application.applicationId,
      documentType: document.type,
    },
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Document verified successfully", {
      message: "Document verified successfully",
      document: {
        _id: document._id,
        type: document.type,
        status: document.status,
        verifiedAt: document.verifiedAt,
      },
    }),
  );
});

/**
 * @desc    Reject application document
 * @route   PUT /api/admin/applications/:id/documents/:documentId/reject
 * @access  Private (Admin)
 */
const rejectDocument = asyncHandler(async (req, res) => {
  const { id: applicationId, documentId } = req.params;
  const { rejectionReason } = req.body;

  const application = await Application.findById(applicationId).populate(
    "candidateId",
    "fullName email",
  );

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  const document = application.documents.id(documentId);
  if (!document) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Document not found");
  }

  document.status = "rejected";
  document.rejectionReason = rejectionReason;
  document.verifiedBy = req.user.id;
  document.verifiedAt = new Date();

  // Update application document status
  application.documentStatus = "incomplete";
  await application.save();
  const candidateName = getApplicationCandidateName(application);

  // Real-time notifications
  emitToAdmins(SOCKET_EVENTS.DOCUMENT_REJECTED, {
    type: "document_rejected",
    message: `Document rejected for application ${application.applicationId}`,
    application: {
      _id: application._id,
      applicationId: application.applicationId,
      candidateName,
      documentType: document.type,
      rejectionReason,
    },
    timestamp: new Date(),
  });

  emitToCandidate(
    application.candidateId._id,
    SOCKET_EVENTS.DOCUMENT_REJECTED,
    {
      type: "document_rejected",
      message: `Your ${document.type} document has been rejected. Please re-upload.`,
      document: {
        type: document.type,
        status: document.status,
        rejectionReason,
      },
      timestamp: new Date(),
    },
  );

  // Persist notification
  await notify({
    recipientId: application.candidateId._id,
    type: "document_rejected",
    title: "Document Rejected",
    message: `Your ${document.type.replace(/_/g, " ")} was rejected${rejectionReason ? `: ${rejectionReason}` : ". Please re-upload."}`,
    link: `/application/documents`,
    metadata: {
      applicationId: application.applicationId,
      documentType: document.type,
    },
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Document rejected successfully", {
      message: "Document rejected successfully",
      document: {
        _id: document._id,
        type: document.type,
        status: document.status,
        rejectionReason: document.rejectionReason,
      },
    }),
  );
});

/**
 * @desc    Get application statistics
 * @route   GET /api/admin/applications/stats
 * @access  Private (Admin)
 */
const getApplicationStats = asyncHandler(async (req, res) => {
  const statusStats = await Application.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const paymentStats = await Application.aggregate([
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalFee" },
      },
    },
  ]);

  const documentStats = await Application.aggregate([
    {
      $group: {
        _id: "$documentStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const dailyApplications = await Application.aggregate([
    {
      $match: {
        submittedAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(
      StatusCodes.OK,
      "Application statistics fetched successfully",
      {
        statusStats,
        paymentStats,
        documentStats,
        dailyApplications,
      },
    ),
  );
});

module.exports = {
  getApplications,
  getApplication,
  exportApplications,
  repairStorageManifests,
  updateApplicationStatus,
  reviewCorrection,
  bulkUpdateApplications,
  verifyDocument,
  rejectDocument,
  getApplicationStats,
};
