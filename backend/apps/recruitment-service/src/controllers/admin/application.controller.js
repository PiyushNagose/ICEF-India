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
    { $unwind: "$candidate" },
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
      status: 1,
      paymentStatus: 1,
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
  const { status, rejectionReason } = req.body;
  const applicationId = req.params.id;

  const application = await Application.findById(applicationId)
    .populate("candidateId", "fullName email")
    .populate("jobId", "title");

  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }

  const oldStatus = application.status;
  application.status = status;
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();

  if (status === "rejected" && rejectionReason) {
    application.rejectionReason = rejectionReason;
  }

  await application.save();

  // Persist notification in DB + real-time push
  const notifType =
    status === "verified" || status === "approved"
      ? "application_approved"
      : status === "rejected"
        ? "application_rejected"
        : "general";

  const notifTitle =
    status === "verified" || status === "approved"
      ? "Application Approved"
      : status === "rejected"
        ? "Application Rejected"
        : "Application Status Updated";

  const notifMessage =
    status === "rejected" && rejectionReason
      ? `Your application ${application.applicationId} was rejected. Reason: ${rejectionReason}`
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
    message: `${application.candidateId.fullName}'s application ${application.applicationId} for "${application.jobId?.title}" has been ${status}.`,
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
      candidateName: application.candidateId.fullName,
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
        rejectionReason,
      },
      timestamp: new Date(),
    },
  );

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application status updated successfully", {
      message: "Application status updated successfully",
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        status: application.status,
        reviewedBy: application.reviewedBy,
        reviewedAt: application.reviewedAt,
      },
    }),
  );
});

/**
 * @desc    Bulk update application status
 * @route   POST /api/admin/applications/bulk-action
 * @access  Private (Admin)
 */
const bulkUpdateApplications = asyncHandler(async (req, res) => {
  const { applicationIds, action, status, rejectionReason } = req.body;

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
    .populate("jobId", "title");

  if (applications.length === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, "No applications found");
  }

  const updateData = {
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  };

  if (action === "update_status") {
    updateData.status = status;
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
  }

  // Update all applications
  await Application.updateMany({ _id: { $in: applicationIds } }, updateData);

  // Send real-time notifications
  applications.forEach((application) => {
    // Notify admins
    emitToAdmins(SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
      type: "bulk_application_update",
      message: `Application ${application.applicationId} updated via bulk action`,
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        candidateName: application.candidateId.fullName,
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
      candidateName: application.candidateId.fullName,
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

  // Real-time notifications
  emitToAdmins(SOCKET_EVENTS.DOCUMENT_REJECTED, {
    type: "document_rejected",
    message: `Document rejected for application ${application.applicationId}`,
    application: {
      _id: application._id,
      applicationId: application.applicationId,
      candidateName: application.candidateId.fullName,
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
  updateApplicationStatus,
  bulkUpdateApplications,
  verifyDocument,
  rejectDocument,
  getApplicationStats,
};
