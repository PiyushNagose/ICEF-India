const { StatusCodes } = require("http-status-codes");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
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
const {
  generateApplicationId,
  calculateFee,
  getPaginationParams,
} = require("../../shared/utils/helpers");
const {
  uploadToCloudinary,
  validateFileSize,
  deleteFromCloudinary,
} = require("../../shared/services/upload.service");
const { notify } = require("../../shared/utils/notify");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");
const {
  assertApplicationWindowOpen,
  assertCorrectionWindowOpen,
  assertPaymentWindowOpen,
} = require("../../shared/utils/timeline");

// ── Helpers ───────────────────────────────────────────────────

const emitStepSaved = (candidateId, applicationId, currentStep, extra = {}) => {
  try {
    emitToCandidate(candidateId, SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
      type: "step_saved",
      application: { _id: applicationId, currentStep, ...extra },
      timestamp: new Date(),
    });
  } catch (_) {}
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const RESERVED_FORM_SECTION_TITLES = new Set([
  "personal information",
  "personal details",
  "personal info",
  "candidate details",
  "educational info",
  "educational information",
  "education",
  "additional information",
  "additional info",
  "address details",
  "address information",
  "address",
  "document upload",
  "documents",
  "payment",
  "review",
  "post selection",
]);

const normalizeTitle = (title = "") =>
  String(title).trim().toLowerCase().replace(/\s+/g, " ");

const isEarlyPaymentApplication = (app = {}) =>
  ["after_personal", "step1"].includes(
    app?.jobId?.paymentConfig?.paymentTiming ||
      app?.paymentTiming ||
      app?.paymentConfig?.paymentTiming,
  );

const getCustomFormSections = (job) =>
  Array.isArray(job?.formSections)
    ? job.formSections.filter(
        (section) =>
          Array.isArray(section.fields) &&
          section.fields.length > 0 &&
          !RESERVED_FORM_SECTION_TITLES.has(normalizeTitle(section.title)),
      )
    : [];

const ensurePublicRegistrationNumber = async (app) => {
  if (!app?.isPublicApplication || app.registrationNumber) return app;

  const {
    generateRegistrationNumber,
    buildProjectCode,
  } = require("../../shared/services/registrationNumber.service");
  const Project = require("../../shared/models/Project");

  const job = app.jobId?._id ? app.jobId : await Job.findById(app.jobId);
  const project = job?.projectId
    ? await Project.findById(job.projectId).select("name publicSlug")
    : null;
  const projectCode = project
    ? buildProjectCode(project.name, new Date().getFullYear())
    : "APP26";
  const registrationNumber = await generateRegistrationNumber(projectCode);
  const numericPart = parseInt(registrationNumber.slice(-6), 10) || 1;
  const batchNumber = `batch-${Math.ceil(numericPart / 10000)}`;

  app.registrationNumber = registrationNumber;
  app.fileStorage = {
    ...(app.fileStorage || {}),
    batchNumber,
    basePath: `recruitment_portal/projects/${project?.publicSlug || "general"}/applicants/${batchNumber}/${registrationNumber}`,
  };

  await User.findByIdAndUpdate(app.candidateId?._id || app.candidateId, {
    registrationNumber,
  });

  return app;
};

const assertCandidateMutationWindow = (app) => {
  const correctionOpen = ["requested", "in_progress"].includes(
    app.correction?.status,
  );
  if (correctionOpen) {
    assertCorrectionWindowOpen(app.jobId);
  } else {
    assertApplicationWindowOpen(app.jobId);
  }
};

// Calculate the correct step number based on job configuration
// Fixed steps: 1=Personal, 2=Education, 3=AdditionalInfo, 4=Address
// Dynamic steps: 5+=CustomForms, Documents, Review, PostSelection, Payment, Submit
const getNextStepNumber = (job, currentStepType) => {
  let stepNum = 4; // After fixed 4 steps

  // Add custom form sections
  const formSections = getCustomFormSections(job);
  if (formSections.length > 0) {
    stepNum += formSections.length;
  }

  // Documents step is always part of the candidate journey. The documents
  // shown inside that step are still controlled by the selected job.
  stepNum += 1;

  // Review is always next
  stepNum += 1;

  stepNum += 1;

  // Payment and Submit are always last
  // stepNum += 2; (will be added by caller if needed)

  return stepNum;
};

const assertApplicationCompleteForJob = (app) => {
  const job = app.jobId;
  const responses =
    app.formResponses instanceof Map
      ? Object.fromEntries(app.formResponses)
      : app.formResponses || {};

  getCustomFormSections(job).forEach((section) => {
    (section.fields || []).forEach((field) => {
      if (field.type === "file") return;
      const value = responses[String(field._id)];
      const empty =
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && value.trim() === "");
      if (field.required && empty) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `${field.label} is required`,
        );
      }
    });
  });

  const requiredDocs = (job.documentRequirements || [])
    .filter((doc) => doc.required !== false)
    .map((doc) => slugify(doc.name));
  const uploadedDocs = new Set(
    (app.documents || [])
      .filter((doc) => ["uploaded", "verified"].includes(doc.status))
      .map((doc) => doc.type),
  );
  const missingDoc = requiredDocs.find((type) => !uploadedDocs.has(type));
  if (missingDoc) {
    const doc = (job.documentRequirements || []).find(
      (item) => slugify(item.name) === missingDoc,
    );
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${doc?.name || "Required document"} is required`,
    );
  }
};

// ── Controllers ───────────────────────────────────────────────

/**
 * @swagger
 * /api/candidate/applications:
 *   post:
 *     tags: [Candidate - Applications]
 *     summary: Start a new application for a job
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId]
 *             properties:
 *               jobId:
 *                 type: string
 *     responses:
 *       201: { description: Application created }
 *       409: { description: Already applied }
 */
const createApplication = asyncHandler(async (req, res) => {
  const { jobId } = req.body;
  const candidateId = req.user.id;

  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  if (job.status !== "active")
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Job is not accepting applications",
    );

  const candidate = await User.findById(candidateId);
  const isPublicApplySession =
    candidate?.accountType === "ghost" ||
    candidate?.createdVia === "public_application";

  const existing = await Application.findOne({ candidateId, jobId }).populate(
    "jobId",
    "title department postCode applicationDeadline formSections documentRequirements posts postSelectionMode applicationFee paymentConfig",
  );
  if (existing && existing.status !== "draft")
    throw new ApiError(
      StatusCodes.CONFLICT,
      "You have already applied for this job",
      [
        {
          field: "jobId",
          message: "Application already exists for this recruitment",
          applicationId: existing._id,
          publicApplicationId: existing.applicationId,
          status: existing.status,
          registrationNumber: existing.registrationNumber,
        },
      ],
    );

  if (!existing && isPublicApplySession) {
    const duplicateContactFilters = [];
    if (candidate.email) duplicateContactFilters.push({ contactEmail: candidate.email });
    if (candidate.registeredMobile)
      duplicateContactFilters.push({ contactMobile: candidate.registeredMobile });

    const contactDuplicate = duplicateContactFilters.length
      ? await Application.findOne({
          jobId,
          status: { $ne: "draft" },
          $or: duplicateContactFilters,
        }).select("_id applicationId status registrationNumber")
      : null;

    if (contactDuplicate) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "You have already applied for this job",
        [
          {
            field: "jobId",
            message: "Application already exists for this recruitment",
            applicationId: contactDuplicate._id,
            publicApplicationId: contactDuplicate.applicationId,
            status: contactDuplicate.status,
            registrationNumber: contactDuplicate.registrationNumber,
          },
        ],
      );
    }
  }

  assertApplicationWindowOpen(job);

  if (existing?.status === "draft") {
    if (isPublicApplySession && !existing.isPublicApplication) {
      existing.isPublicApplication = true;
      existing.contactEmail = existing.contactEmail || candidate.email;
      existing.contactMobile =
        existing.contactMobile || candidate.registeredMobile || "";
      await existing.save();
    }
    return res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "Existing draft application resumed", {
        application: existing,
      }),
    );
  }

  const application = await Application.create({
    applicationId: generateApplicationId(),
    candidateId,
    jobId,
    isPublicApplication: isPublicApplySession,
    contactEmail: isPublicApplySession ? candidate.email : undefined,
    contactMobile: isPublicApplySession
      ? candidate.registeredMobile || ""
      : undefined,
    paymentTiming: job.paymentConfig?.paymentTiming || "final",
    personalDetails: {
      fullName: candidate.fullName || "",
      registeredMobile: candidate.registeredMobile || "",
      dateOfBirth: candidate.dateOfBirth || null,
      gender: candidate.gender || "",
      category: candidate.category || "",
      fatherName: candidate.fatherName || "",
      motherName: candidate.motherName || "",
      isDomicileOfBihar: candidate.isDomicileOfBihar || false,
    },
    currentStep: 1,
    status: "draft",
  });

  await application.populate(
    "jobId",
    "title department postCode applicationDeadline formSections documentRequirements posts postSelectionMode applicationFee paymentConfig",
  );

  try {
    emitToAdmins(SOCKET_EVENTS.APPLICATION_NEW, {
      type: "application_started",
      message: `New application started: ${application.applicationId}`,
      application: {
        _id: application._id,
        applicationId: application.applicationId,
        jobTitle: job.title,
      },
      timestamp: new Date(),
    });
  } catch (_) {}

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Application created", {
      application,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications:
 *   get:
 *     tags: [Candidate - Applications]
 *     summary: Get my applications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200: { description: My applications }
 */
const getMyApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const filter = { candidateId: req.user.id };
  if (req.query.status) filter.status = req.query.status;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate(
        "jobId",
        "title department postCode applicationDeadline examDate formSections documentRequirements posts postSelectionMode applicationFee paymentConfig",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(
        StatusCodes.OK,
        "Applications fetched",
        applications,
        paginationMeta(total, page, limit),
      ),
    );
});

/**
 * @swagger
 * /api/candidate/applications/{id}:
 *   get:
 *     tags: [Candidate - Applications]
 *     summary: Get a specific application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200: { description: Application details }
 *       404: { description: Not found }
 */
const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  })
    .populate("jobId")
    .populate(
      "candidateId",
      "fullName email registeredMobile dateOfBirth gender category fatherName motherName",
    );

  if (!application)
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Application fetched", { application }),
    );
});

// ── Step update helper ────────────────────────────────────────
const getOwnDraftApplication = async (id, candidateId) => {
  const app = await Application.findOne({ _id: id, candidateId }).populate(
    "jobId",
  );
  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  const correctionOpen = ["requested", "in_progress"].includes(
    app.correction?.status,
  );
  if (app.status !== "draft" && !correctionOpen)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot update this application unless correction is requested",
    );
  if (correctionOpen && app.correction.status === "requested") {
    app.correction.status = "in_progress";
  }
  assertCandidateMutationWindow(app);
  return app;
};

/**
 * @swagger
 * /api/candidate/applications/{id}/personal-details:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Step 1 — Personal Details
 *     security:
 *       - bearerAuth: []
 */
const updatePersonalDetails = asyncHandler(async (req, res) => {
  const app = await getOwnDraftApplication(req.params.id, req.user.id);
  app.personalDetails = {
    ...(app.personalDetails?.toObject?.() || {}),
    ...req.body,
  };
  app.paymentTiming = app.jobId?.paymentConfig?.paymentTiming || app.paymentTiming;
  app.totalFee = calculateFee(
    app.jobId?.applicationFee || {},
    app.personalDetails?.category,
  );
  // Move to next step after completing this one
  app.currentStep = Math.max(app.currentStep, 2);
  app.lastSavedAt = new Date();
  await app.save();
  await app.populate(
    "jobId",
    "title department postCode applicationDeadline formSections documentRequirements posts postSelectionMode applicationFee paymentConfig",
  );
  emitStepSaved(req.user.id, app._id, app.currentStep);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Personal details saved", {
      application: app,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/education:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Step 2 — Education
 *     security:
 *       - bearerAuth: []
 */
const updateEducation = asyncHandler(async (req, res) => {
  const app = await getOwnDraftApplication(req.params.id, req.user.id);
  app.education = { ...(app.education?.toObject?.() || {}), ...req.body };
  app.currentStep = Math.max(app.currentStep, 3);
  app.lastSavedAt = new Date();
  await app.save();
  emitStepSaved(req.user.id, app._id, app.currentStep);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Education details saved", {
      _id: app._id,
      currentStep: app.currentStep,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/additional-info:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Step 3 — Additional Info
 *     security:
 *       - bearerAuth: []
 */
const updateAdditionalInfo = asyncHandler(async (req, res) => {
  const app = await getOwnDraftApplication(req.params.id, req.user.id);
  app.additionalInfo = {
    ...(app.additionalInfo?.toObject?.() || {}),
    ...req.body,
  };
  app.currentStep = Math.max(app.currentStep, 4);
  app.lastSavedAt = new Date();
  await app.save();
  emitStepSaved(req.user.id, app._id, app.currentStep);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Additional info saved", {
      _id: app._id,
      currentStep: app.currentStep,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/address:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Step 4 — Address
 *     security:
 *       - bearerAuth: []
 */
const updateAddress = asyncHandler(async (req, res) => {
  const app = await getOwnDraftApplication(req.params.id, req.user.id);
  app.address = { ...(app.address?.toObject?.() || {}), ...req.body };
  app.currentStep = Math.max(app.currentStep, 5);
  app.lastSavedAt = new Date();
  await app.save();
  emitStepSaved(req.user.id, app._id, app.currentStep);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Address saved", {
      _id: app._id,
      currentStep: app.currentStep,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/form-responses:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Dynamic Form Responses (Custom Fields from Job)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formResponses:
 *                 type: object
 *     responses:
 *       200:
 *         description: Form responses saved
 *       400:
 *         description: Invalid field submission
 *       404:
 *         description: Application or job not found
 */
const updateFormResponses = asyncHandler(async (req, res) => {
  const app = await getOwnDraftApplication(req.params.id, req.user.id);

  // Fetch the job to get formSections for validation
  const job = await Job.findById(app.jobId?._id || app.jobId);
  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  const { formResponses } = req.body;
  const sectionIndex =
    Number.isInteger(Number(req.body.sectionIndex)) &&
    Number(req.body.sectionIndex) >= 0
      ? Number(req.body.sectionIndex)
      : null;
  if (!formResponses || typeof formResponses !== "object") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid formResponses format");
  }

  // Validate that submitted fields exist in job's formSections and satisfy
  // the admin's required/type/option constraints.
  const allowedFieldIds = new Set();
  const fieldMap = new Map();
  const formSections = getCustomFormSections(job);

  formSections.forEach((section) => {
    (section.fields || []).forEach((field) => {
      const id = String(field._id);
      allowedFieldIds.add(id);
      fieldMap.set(id, field);
    });
  });

  // Check that all submitted fields are allowed (security check)
  for (const fieldId of Object.keys(formResponses)) {
    if (!allowedFieldIds.has(fieldId)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Field ${fieldId} is not allowed for this job`,
      );
    }
  }

  const existingResponses =
    app.formResponses instanceof Map
      ? Object.fromEntries(app.formResponses)
      : app.formResponses || {};
  const mergedResponses = Object.fromEntries(
    Object.entries({
      ...existingResponses,
      ...formResponses,
    }).filter(([fieldId]) => allowedFieldIds.has(fieldId)),
  );
  const sectionsToValidate =
    sectionIndex === null
      ? formSections
      : formSections.slice(0, Math.min(sectionIndex + 1, formSections.length));
  const fieldsToValidate = new Map();

  sectionsToValidate.forEach((section) => {
    (section.fields || []).forEach((field) => {
      fieldsToValidate.set(String(field._id), field);
    });
  });
  Object.keys(formResponses).forEach((fieldId) => {
    const field = fieldMap.get(fieldId);
    if (field) fieldsToValidate.set(fieldId, field);
  });

  for (const [fieldId, field] of fieldsToValidate.entries()) {
    if (field.type === "file") continue;
    const value = mergedResponses[fieldId];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "string" && value.trim() === "");

    if (field.required && empty) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `${field.label} is required`);
    }

    if (empty) continue;

    if (["select", "radio"].includes(field.type)) {
      const options = field.options || [];
      if (!options.includes(value)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `${field.label} has an invalid selected option`,
        );
      }
    }

    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `${field.label} must be a valid email`,
      );
    }

    if (
      field.type === "tel" &&
      !/^[6-9]\d{9}$/.test(String(value).replace(/\D/g, ""))
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `${field.label} must be a valid mobile number`,
      );
    }

    if (field.type === "number") {
      const num = Number(value);
      if (Number.isNaN(num)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `${field.label} must be a number`,
        );
      }
      if (field.validation?.min !== undefined && num < field.validation.min) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          field.validation.message || `${field.label} is below minimum`,
        );
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          field.validation.message || `${field.label} is above maximum`,
        );
      }
    }

    if (field.validation?.pattern) {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(value))) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            field.validation.message || `${field.label} is invalid`,
          );
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
  }

  // Update formResponses in application
  app.formResponses = new Map(Object.entries(mergedResponses));

  // Compute the correct next step dynamically based on job config
  // Fixed steps: 1-4. Custom form sections: 5..4+N. Documents: 4+N+1. Review: 4+N+2. etc.
  const formSectionsCount = formSections.length;
  const completedSectionIndex =
    sectionIndex === null
      ? formSectionsCount - 1
      : Math.min(sectionIndex, Math.max(formSectionsCount - 1, 0));
  const nextStepAfterCurrentSection = 4 + completedSectionIndex + 2;
  app.currentStep = Math.max(app.currentStep, nextStepAfterCurrentSection);
  app.lastSavedAt = new Date();
  await app.save();

  emitStepSaved(req.user.id, app._id, app.currentStep);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Form responses saved", {
      _id: app._id,
      currentStep: app.currentStep,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/documents/{type}:
 *   post:
 *     tags: [Candidate - Applications]
 *     summary: Upload Step 5 — Document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [passport_photo, signature, tenth_certificate, twelfth_certificate, graduation_certificate, category_certificate, aadhar_card, driving_license, computer_certificate, domicile_certificate]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200: { description: Document uploaded }
 */
const uploadDocument = asyncHandler(async (req, res) => {
  // Allow document uploads on both draft and submitted apps (before payment)
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  });
  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  const correctionOpen = ["requested", "in_progress"].includes(
    app.correction?.status,
  );
  await app.populate("jobId");
  if (
    app.paymentStatus === "paid" &&
    app.status !== "draft" &&
    !correctionOpen &&
    !isEarlyPaymentApplication(app)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot upload documents after payment is completed",
    );
  }
  if (correctionOpen && app.correction.status === "requested") {
    app.correction.status = "in_progress";
  }
  const docType = req.params.type;
  assertCandidateMutationWindow(app);

  const requirements = (app.jobId?.documentRequirements || []).filter(
    (doc) => doc?.name,
  );
  if (requirements.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No document uploads are configured for this job",
    );
  }

  const requirementMap = new Map(
    requirements.map((doc) => [slugify(doc.name), doc]),
  );
  const selectedRequirement = requirementMap.get(docType);
  if (!selectedRequirement) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This document is not required for this job",
    );
  }

  if (!req.file)
    throw new ApiError(StatusCodes.BAD_REQUEST, "No file uploaded");

  const maxSizeKB = selectedRequirement?.maxSizeKB;
  if (maxSizeKB && req.file.size > maxSizeKB * 1024) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `File too large. Max size for ${selectedRequirement.name}: ${maxSizeKB}KB`,
    );
  } else {
    validateFileSize(req.file.size, docType);
  }

  // Delete old document from Cloudinary if exists
  const existingDoc = app.documents.find((d) => d.type === docType);
  if (existingDoc?.cloudinaryPublicId) {
    await deleteFromCloudinary(existingDoc.cloudinaryPublicId);
  }
  if (existingDoc?.localPath) {
    fs.promises.unlink(existingDoc.localPath).catch(() => {});
  }

  // Upload to Cloudinary
  const result = await uploadToCloudinary(req.file.buffer, {
    folder: `recruitment_portal/applications/${app._id}/${docType}`,
    public_id: `${docType}_${Date.now()}`,
  });

  const safeOriginalName = path
    .basename(req.file.originalname || docType)
    .replace(/[^\w.\-() ]+/g, "_");
  const localDir = path.resolve(
    process.cwd(),
    "uploads",
    "applications",
    String(app._id),
    docType,
  );
  await fs.promises.mkdir(localDir, { recursive: true });
  const localPath = path.join(localDir, `${Date.now()}-${safeOriginalName}`);
  await fs.promises.writeFile(localPath, req.file.buffer);

  // Update or add document entry
  const docData = {
    type: docType,
    name: selectedRequirement?.name || docType.replace(/_/g, " "),
    cloudinaryUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    localPath,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
    sizeKB: Math.round(req.file.size / 1024),
    status: "uploaded",
    uploadedAt: new Date(),
  };

  if (existingDoc) {
    Object.assign(existingDoc, docData);
  } else {
    app.documents.push(docData);
  }

  app.currentStep = Math.max(
    app.currentStep,
    (() => {
      // Compute documents step number dynamically
      const formSectionsCount = getCustomFormSections(app.jobId).length;
      return 4 + formSectionsCount + 1 + 1;
    })(),
  );
  app.lastSavedAt = new Date();

  // Check if all required docs are uploaded
  const uploadedTypes = app.documents
    .filter((d) => d.status === "uploaded")
    .map((d) => d.type);
  const requiredTypes =
    requirements.length > 0
      ? requirements
          .filter((doc) => doc.required !== false)
          .map((doc) => slugify(doc.name))
      : [
          "passport_photo",
          "signature",
          "tenth_certificate",
          "twelfth_certificate",
        ];
  const allRequired = requiredTypes.every((t) => uploadedTypes.includes(t));
  if (allRequired) app.documentStatus = "pending";

  await app.save();

  emitStepSaved(req.user.id, app._id, app.currentStep, {
    documentType: docType,
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Document uploaded successfully", {
      document: docData,
      currentStep: app.currentStep,
      documentStatus: app.documentStatus,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/post-selection:
 *   put:
 *     tags: [Candidate - Applications]
 *     summary: Save Step 7 — Post Selection
 *     security:
 *       - bearerAuth: []
 */
const updatePostSelection = asyncHandler(async (req, res) => {
  const { appliedPosts } = req.body;

  // Allow updating post-selection on both draft and submitted apps
  // (submitted apps may need to update posts before payment is finalized)
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  });
  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  // Block only if payment is already done
  const correctionOpen = ["requested", "in_progress"].includes(
    app.correction?.status,
  );
  await app.populate("jobId");
  if (
    app.paymentStatus === "paid" &&
    !correctionOpen &&
    !isEarlyPaymentApplication(app)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot update post selection after payment is completed",
    );
  }
  if (correctionOpen && app.correction.status === "requested") {
    app.correction.status = "in_progress";
  }

  assertCandidateMutationWindow(app);

  const candidate = await User.findById(req.user.id).select("category");
  const activeJobPosts = (app.jobId.posts || []).filter(
    (post) => post.status !== "inactive",
  );
  const availablePosts =
    activeJobPosts.length > 0
      ? activeJobPosts
      : [
          {
            _id: app.jobId._id,
            postCode: app.jobId.postCode,
            title: app.jobId.title,
            designation: app.jobId.title,
            department: app.jobId.department,
            vacancies: app.jobId.totalPosts,
          },
        ];
  const availablePostMap = new Map(
    availablePosts.map((post) => [post._id.toString(), post]),
  );
  const postSelectionMode = app.jobId.postSelectionMode || "single";
  const requestedPosts = Array.isArray(appliedPosts) ? appliedPosts : [];
  if (requestedPosts.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Select at least one post");
  }
  if (postSelectionMode !== "preference" && requestedPosts.length > 1) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This recruitment allows only one post selection",
    );
  }
  const preferences = new Set();
  const selectedPostIds = new Set();

  const postsWithFee = requestedPosts.map((post, index) => {
    const key = (post.postId || post.jobId || "").toString();
    const jobPost = availablePostMap.get(key);
    if (!jobPost) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Selected post is not available for this job",
      );
    }

    if (selectedPostIds.has(key)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "A post can be selected only once",
      );
    }
    selectedPostIds.add(key);

    const preference = postSelectionMode === "preference" ? post.preference : 1;
    if (preferences.has(preference)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Post preferences must be unique",
      );
    }
    preferences.add(preference);

    return {
      jobId: app.jobId._id,
      postId: jobPost._id,
      postCode: jobPost.postCode || "",
      title: jobPost.title || jobPost.designation,
      designation: jobPost.designation || jobPost.title,
      department: jobPost.department || app.jobId.department || "",
      vacancies: jobPost.vacancies || 0,
      preference: preference || index + 1,
      fee: 0,
    };
  });

  postsWithFee.sort((a, b) => a.preference - b.preference);

  const totalFee = calculateFee(
    app.jobId.applicationFee || {},
    app.personalDetails?.category || candidate?.category,
  );
  postsWithFee.forEach((post, index) => {
    post.preference = index + 1;
    post.fee = index === 0 ? totalFee : 0;
  });

  app.appliedPosts = postsWithFee;
  app.totalFee = totalFee;
  // Compute post-selection step number dynamically
  const formSectionsCountPS = getCustomFormSections(app.jobId).length;
  const postSelectionStepNum = 4 + formSectionsCountPS + 1 + 1 + 1;
  app.currentStep = Math.max(app.currentStep, postSelectionStepNum);
  app.lastSavedAt = new Date();
  await app.save();

  emitStepSaved(req.user.id, app._id, app.currentStep, { totalFee });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Post selection saved", {
      _id: app._id,
      currentStep: app.currentStep,
      appliedPosts: app.appliedPosts,
      totalFee: app.totalFee,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/submit:
 *   post:
 *     tags: [Candidate - Applications]
 *     summary: Final submission of application
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [declaration]
 *             properties:
 *               declaration:
 *                 type: string
 *     responses:
 *       200: { description: Application submitted }
 *       400: { description: Payment pending or steps incomplete }
 */
const submitApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  }).populate("jobId");

  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  // Allow re-submission if already submitted (idempotent)
  if (app.status === "submitted") {
    return res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "Application already submitted", {
        _id: app._id,
        applicationId: app.applicationId,
        status: app.status,
        submittedAt: app.submittedAt,
      }),
    );
  }

  if (app.status !== "draft")
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot update a non-draft application",
    );

  // Save declaration and advance step — actual final submit happens via /finalize after payment
  assertApplicationWindowOpen(app.jobId);

  if (req.body.declaration) {
    app.declaration = req.body.declaration;
  }

  // Compute review step number dynamically
  await app.populate("jobId");
  const formSectionsCount = getCustomFormSections(app.jobId).length;
  const reviewStepNum = 4 + formSectionsCount + 1 + 1;
  // Always keep as draft — finalize handles the actual submission
  app.currentStep = Math.max(app.currentStep, reviewStepNum);
  app.lastSavedAt = new Date();
  await app.save();

  const candidate = await User.findById(req.user.id).select("fullName email");

  try {
    emitToAdmins(SOCKET_EVENTS.APPLICATION_SUBMITTED, {
      type: "application_submitted",
      message: `Application submitted: ${app.applicationId}`,
      application: {
        _id: app._id,
        applicationId: app.applicationId,
        candidateName: candidate?.fullName,
        jobTitle: app.jobId.title,
      },
      timestamp: new Date(),
    });

    emitToCandidate(req.user.id, SOCKET_EVENTS.APPLICATION_SUBMITTED, {
      type: "submitted",
      message: "Your application has been submitted successfully!",
      application: {
        _id: app._id,
        applicationId: app.applicationId,
        status: app.status,
      },
      timestamp: new Date(),
    });
  } catch (_) {}

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application submitted successfully", {
      _id: app._id,
      applicationId: app.applicationId,
      status: app.status,
      submittedAt: app.submittedAt,
    }),
  );
});

/**
 * @swagger
 * /api/candidate/applications/{id}/finalize:
 *   post:
 *     tags: [Candidate - Applications]
 *     summary: Finalize application after payment (Step 9)
 *     security:
 *       - bearerAuth: []
 */
const finalizeApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  }).populate("jobId");

  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  // Already fully finalized with payment — idempotent
  if (["submitted", "approved"].includes(app.status) && app.paymentStatus === "paid") {
    if (app.status === "submitted") app.status = "approved";
    await ensurePublicRegistrationNumber(app);
    await app.save();
    return res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "Application already submitted", {
        _id: app._id,
        applicationId: app.applicationId,
        registrationNumber: app.registrationNumber,
        status: app.status,
        submittedAt: app.submittedAt,
      }),
    );
  }

  assertApplicationCompleteForJob(app);
  assertPaymentWindowOpen(app.jobId);

  const totalDue = Number(app.totalFee || 0);
  if (totalDue > 0 && app.paymentStatus !== "paid") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment is pending");
  }

  // Free applications are finalized without a gateway transaction.
  if (totalDue === 0) app.paymentStatus = "paid";
  app.status = "approved";
  app.submittedAt = new Date();
  const formSectionsCount = getCustomFormSections(app.jobId).length;
  app.currentStep = 9 + formSectionsCount;
  if (req.body.transactionId) app.transactionId = req.body.transactionId;
  if (req.body.declaration) app.declaration = req.body.declaration;

  await ensurePublicRegistrationNumber(app);

  await app.save();

  const candidate = await User.findById(req.user.id).select("fullName email");

  // Notify candidate — payment success
  await notify({
    recipientId: req.user.id,
    type: "payment_success",
    title: "Payment Successful",
    message: `Your payment for application ${app.applicationId} was successful. Application approved automatically.`,
    link: `/candidate/applications`,
    metadata: {
      applicationId: app.applicationId,
      transactionId: req.body.transactionId || "",
    },
  });

  // Notify candidate — application submitted
  await notify({
    recipientId: req.user.id,
    type: "application_submitted",
    title: "Application Submitted",
    message: `Your application ${app.applicationId} for ${app.jobId?.title || "the job"} has been submitted successfully.`,
    link: `/candidate/applications`,
    metadata: { applicationId: app.applicationId },
  });

  // Notify all admins — new application received
  notifyAdmins({
    type: "application_submitted",
    title: "New Application Received",
    message: `${candidate?.fullName || "A candidate"} submitted application ${app.applicationId} for "${app.jobId?.title || "a job"}".`,
    link: `/admin/applications/${app._id}`,
    metadata: { applicationId: app.applicationId },
  });

  try {
    emitToAdmins(SOCKET_EVENTS.APPLICATION_SUBMITTED, {
      type: "application_submitted",
      message: `Application submitted: ${app.applicationId}`,
      application: {
        _id: app._id,
        applicationId: app.applicationId,
        candidateName: candidate?.fullName,
        jobTitle: app.jobId?.title,
      },
      timestamp: new Date(),
    });

    emitToCandidate(req.user.id, SOCKET_EVENTS.APPLICATION_SUBMITTED, {
      type: "submitted",
      message: "Your application has been submitted successfully!",
      application: {
        _id: app._id,
        applicationId: app.applicationId,
        status: app.status,
      },
      timestamp: new Date(),
    });
  } catch (_) {}

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Application finalized successfully", {
      _id: app._id,
      applicationId: app.applicationId,
      registrationNumber: app.registrationNumber,
      status: app.status,
      submittedAt: app.submittedAt,
    }),
  );
});

/**
 * Submit corrections after admin requested edits.
 * Updates the SAME application in place, transitions correction.status → "submitted",
 * puts application back to "under_review", and notifies admins for re-review.
 *
 * POST /api/candidate/applications/:id/submit-correction
 */
const submitCorrection = asyncHandler(async (req, res) => {
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  }).populate("jobId");

  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  const correctionOpen = ["requested", "in_progress"].includes(
    app.correction?.status,
  );
  if (!correctionOpen) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No correction is pending for this application",
    );
  }

  assertCorrectionWindowOpen(app.jobId);

  // Validate that all required fields/documents are present
  assertApplicationCompleteForJob(app);

  // Save declaration if provided
  if (req.body.declaration) {
    app.declaration = req.body.declaration;
  }

  // Remember the linked support ticket before saving so we can use it in
  // the admin notification link (direct deep-link into the support ticket).
  const linkedTicketId = app.correction?.supportTicket;

  // Mark correction as submitted and set application back to under_review
  app.correction.status = "submitted";
  app.correction.submittedAt = new Date();
  app.status = "under_review";
  app.submittedAt = app.submittedAt || new Date(); // keep original submit date

  const formSectionsCount = getCustomFormSections(app.jobId).length;
  app.currentStep = 9 + formSectionsCount;
  app.lastSavedAt = new Date();
  await app.save();

  const candidate = await User.findById(req.user.id).select(
    "fullName email registeredMobile",
  );

  // Admin notification link — go straight to the support ticket if one exists,
  // otherwise fall back to the application detail page.
  const adminLink = linkedTicketId
    ? `/admin/support/tickets/${linkedTicketId}`
    : `/admin/applications/${app._id}`;

  // Notify candidate
  await notify({
    recipientId: req.user.id,
    type: "general",
    title: "Corrections Submitted",
    message: `Your corrections for application ${app.applicationId} have been submitted. Admin will review shortly.`,
    link: `/candidate/applications/${app._id}`,
    metadata: { applicationId: app.applicationId },
  });

  // Notify all admins with candidate details + deep-link to support ticket
  notifyAdmins({
    type: "application_updated",
    title: "Application Corrections Submitted",
    message: `${candidate?.fullName || "A candidate"} (${candidate?.email || ""}) submitted corrections for application ${app.applicationId} — "${app.jobId?.title || ""}". Please review and resolve.`,
    link: adminLink,
    metadata: {
      applicationId: app.applicationId,
      applicationDbId: String(app._id),
      candidateName: candidate?.fullName || "",
      candidateEmail: candidate?.email || "",
      ...(linkedTicketId && { supportTicketId: String(linkedTicketId) }),
      correctionSubmittedAt: new Date().toISOString(),
    },
  });

  try {
    emitToAdmins(SOCKET_EVENTS.APPLICATION_UPDATED, {
      type: "correction_submitted",
      message: `${candidate?.fullName || "Candidate"} submitted corrections for ${app.applicationId}`,
      applicationId: app.applicationId,
      applicationDbId: app._id,
      candidateName: candidate?.fullName,
      candidateEmail: candidate?.email,
      jobTitle: app.jobId?.title,
      adminLink,
      timestamp: new Date(),
    });

    emitToCandidate(req.user.id, SOCKET_EVENTS.APPLICATION_STATUS_CHANGED, {
      type: "correction_submitted",
      message: "Your corrections have been submitted for review.",
      application: {
        _id: app._id,
        applicationId: app.applicationId,
        status: app.status,
      },
      timestamp: new Date(),
    });
  } catch (_) {}

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Corrections submitted successfully", {
      _id: app._id,
      applicationId: app.applicationId,
      status: app.status,
      correctionStatus: app.correction.status,
      submittedAt: app.correction.submittedAt,
    }),
  );
});

const previewDocument = asyncHandler(async (req, res) => {
  const app = await Application.findOne({
    _id: req.params.id,
    candidateId: req.user.id,
  });
  if (!app) throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");

  const document = app.documents.find((doc) => doc.type === req.params.type);
  if (!document?.localPath && !document?.cloudinaryUrl) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Document not found");
  }

  const filename = (document.originalName || document.name || "document").replace(
    /["\\]/g,
    "_",
  );

  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (document.localPath && fs.existsSync(document.localPath)) {
    res.setHeader(
      "Content-Type",
      document.mimeType || "application/octet-stream",
    );
    return fs.createReadStream(document.localPath).pipe(res);
  }

  const response = await fetch(document.cloudinaryUrl);
  if (!response.ok) {
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      "Unable to load document preview. Please re-upload the document or contact support.",
    );
  }

  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") ||
      document.mimeType ||
      "application/octet-stream",
  );
  return Readable.fromWeb(response.body).pipe(res);
});

module.exports = {
  createApplication,
  getMyApplications,
  getApplication,
  updatePersonalDetails,
  updateEducation,
  updateAdditionalInfo,
  updateAddress,
  updateFormResponses,
  uploadDocument,
  previewDocument,
  updatePostSelection,
  submitApplication,
  finalizeApplication,
  submitCorrection,
};
