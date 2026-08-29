const { StatusCodes } = require("http-status-codes");
const Job = require("../../shared/models/Job");
const Project = require("../../shared/models/Project");
const Application = require("../../shared/models/Application");
const ExamSchedule = require("../../shared/models/ExamSchedule");
const ApiError = require("../../shared/utils/ApiError");
const {
  ApiResponse,
  paginationMeta,
} = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");
const { getPaginationParams } = require("../../shared/utils/helpers");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const {
  assertJobTimeline,
  getProjectLifecycleStatus,
  parseDate,
  startOfDay,
  endOfDay,
} = require("../../shared/utils/timeline");

const JOB_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "applicationDeadline",
  "title",
  "postCode",
  "status",
  "totalPosts",
]);
const {
  invalidatePublicRecruitmentCache,
} = require("../../shared/utils/publicCache");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");

const normalizePosts = (posts = []) =>
  posts
    .filter((post) => post && post.title && post.designation)
    .map((post) => ({
      ...post,
      vacancies: Number(post.vacancies) || 0,
      status: post.status || "active",
    }));

const getPostVacancyTotal = (posts = []) =>
  posts.reduce((sum, post) => sum + (Number(post.vacancies) || 0), 0);

const getPublishValidationErrors = (job) => {
  const errors = [];
  if (!job.projectId) errors.push("Project is required");
  if (!job.title) errors.push("Advertisement / exam title is required");
  if (!job.postCode) errors.push("Advertisement / exam code is required");
  if (!job.department) errors.push("Department is required");

  const posts = Array.isArray(job.posts) ? job.posts : [];
  if (!posts.length) {
    errors.push("At least one post/designation is required");
  } else {
    posts.forEach((post, index) => {
      const label = `Post ${index + 1}`;
      if (!post.title) errors.push(`${label}: title is required`);
      if (!post.designation) errors.push(`${label}: designation is required`);
      if (!Number(post.vacancies) || Number(post.vacancies) < 1) {
        errors.push(`${label}: vacancies must be at least 1`);
      }
    });
  }

  if (!job.applicationStartDate) errors.push("Application start date is required");
  if (!job.applicationDeadline) errors.push("Application deadline is required");

  return errors;
};

const getBodyPaths = (value, prefix = "") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.keys(value).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value[key] &&
      typeof value[key] === "object" &&
      !Array.isArray(value[key]) &&
      !(value[key] instanceof Date)
    ) {
      const childPaths = getBodyPaths(value[key], path);
      return childPaths.length ? childPaths : [path];
    }
    return [path];
  });
};

const pathTouched = (paths, field) =>
  paths.some((path) => path === field || path.startsWith(`${field}.`));

const isEmptyComparableValue = (value) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    Object.keys(value).length === 0);

const stripMongoKeys = (value) => {
  if (Array.isArray(value)) {
    const next = value.map(stripMongoKeys).filter((item) => item !== undefined);
    return next.length ? next : null;
  }
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const plain = typeof value.toObject === "function" ? value.toObject() : value;
    const next = Object.keys(plain)
      .filter((key) => !["_id", "id", "__v", "createdAt", "updatedAt"].includes(key))
      .sort()
      .reduce((acc, key) => {
        if (typeof plain[key] !== "function" && plain[key] !== undefined) {
          acc[key] = stripMongoKeys(plain[key]);
        }
        return acc;
      }, {});
    return isEmptyComparableValue(next) ? null : next;
  }
  return value ?? null;
};

const valuesEqual = (left, right) =>
  JSON.stringify(stripMongoKeys(left)) === JSON.stringify(stripMongoKeys(right));

const isDateLikeField = (field) =>
  /date|deadline/i.test(field);

const dateValuesEqual = (left, right) => {
  const a = parseDate(left);
  const b = parseDate(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return startOfDay(a).getTime() === startOfDay(b).getTime();
};

const bodyFieldChanged = (body, job, field) => {
  if (body[field] === undefined) return false;
  if (isDateLikeField(field)) return !dateValuesEqual(body[field], job[field]);
  return !valuesEqual(body[field], job[field]);
};

const bodyNestedChanged = (body, job, parent, key) =>
  body[parent]?.[key] !== undefined &&
  (isDateLikeField(key)
    ? !dateValuesEqual(body[parent][key], job[parent]?.[key])
    : !valuesEqual(body[parent][key], job[parent]?.[key]));

const isDateBefore = (left, right) => {
  const a = parseDate(left);
  const b = parseDate(right);
  return Boolean(a && b && a < b);
};

const isTodayOrAfter = (value) => {
  const date = startOfDay(value);
  return Boolean(date && startOfDay(new Date()) >= date);
};

const enforcePublishedJobEditPolicy = async ({ job, body }) => {
  if (job.status !== "active") return;

  const applicationCount = await Application.countDocuments({ jobId: job._id });
  const paths = getBodyPaths(body);
  const hasApplications = applicationCount > 0;
  const applicationStarted = isTodayOrAfter(job.applicationStartDate);
  const admitReleased = isTodayOrAfter(job.admitCardReleaseDate);
  const admitWindowPublished = await ExamSchedule.exists({
    jobId: job._id,
    status: "published",
  });

  if (
    applicationStarted &&
    pathTouched(paths, "applicationStartDate") &&
    bodyFieldChanged(body, job, "applicationStartDate")
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Application start date cannot be changed after the application window has opened.",
    );
  }

  if (!hasApplications) return;

  const blockedAfterApplications = [
    "projectId",
    "postCode",
    "department",
    "category",
    "jobType",
    "totalPosts",
    "posts",
    "postSelectionMode",
    "reservedPosts",
    "salaryRange",
    "applicationFee",
    "ageLimit",
    "standardPresetId",
    "education",
    "experience",
    "physicalStandards",
    "medicalStandards",
    "otherRequirements",
    "formSections",
    "documentRequirements",
  ];
  const attemptedBlocked = blockedAfterApplications.filter((field) =>
    pathTouched(paths, field) && bodyFieldChanged(body, job, field),
  );

  if (attemptedBlocked.length > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot change ${attemptedBlocked.join(", ")} after candidates have applied. Create an official amendment instead.`,
    );
  }

  if (body.paymentConfig) {
    const allowedPaymentKeys = ["paymentDeadline", "refundPolicy"];
    const blockedPaymentKeys = Object.keys(body.paymentConfig).filter(
      (key) =>
        !allowedPaymentKeys.includes(key) &&
        bodyNestedChanged(body, job, "paymentConfig", key),
    );
    if (blockedPaymentKeys.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot change payment rules (${blockedPaymentKeys.join(", ")}) after candidates have applied.`,
      );
    }
  }

  if (
    body.applicationDeadline &&
    isDateBefore(body.applicationDeadline, job.applicationDeadline)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Application deadline can only be extended after candidates have applied.",
    );
  }

  if (
    body.paymentConfig?.paymentDeadline &&
    isDateBefore(body.paymentConfig.paymentDeadline, job.paymentConfig?.paymentDeadline)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Payment deadline can only be extended after candidates have applied.",
    );
  }

  if (
    body.correctionStartDate &&
    isTodayOrAfter(job.correctionStartDate) &&
    bodyFieldChanged(body, job, "correctionStartDate")
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Correction start date cannot be changed after the correction window has opened.",
    );
  }

  if (
    body.correctionDeadline &&
    isDateBefore(body.correctionDeadline, job.correctionDeadline)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Correction deadline can only be extended after candidates have applied.",
    );
  }

  const changedEditableFields = Object.keys(body)
    .filter((field) => field !== "amendmentReason")
    .flatMap((field) => {
      if (field === "paymentConfig") {
        return ["paymentDeadline", "refundPolicy"].filter((key) =>
          bodyNestedChanged(body, job, "paymentConfig", key),
        ).map((key) => `paymentConfig.${key}`);
      }
      return bodyFieldChanged(body, job, field) ? [field] : [];
    });

  if (
    changedEditableFields.length > 0 &&
    !String(body.amendmentReason || "").trim()
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Add an amendment reason before saving published job changes after candidates have applied.",
    );
  }

  if (
    (admitReleased || admitWindowPublished) &&
    ((pathTouched(paths, "examDate") && bodyFieldChanged(body, job, "examDate")) ||
      (pathTouched(paths, "admitCardReleaseDate") &&
        bodyFieldChanged(body, job, "admitCardReleaseDate"))) &&
    !String(body.amendmentReason || "").trim()
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Add an amendment reason before changing admit-card release or exam date after admit cards are published or released.",
    );
  }
};

const withComputedProjectStatus = (jobLike) => {
  const job = typeof jobLike.toObject === "function" ? jobLike.toObject() : jobLike;
  if (!job.projectId) return job;
  return {
    ...job,
    projectId: {
      ...job.projectId,
      status: getProjectLifecycleStatus(job.projectId),
    },
  };
};

/**
 * @swagger
 * /api/admin/jobs:
 *   get:
 *     summary: Get all jobs with filters
 *     tags: [Admin - Jobs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, active, closed, cancelled] }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: projectId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Jobs fetched successfully
 *       401:
 *         description: Unauthorized
 */
const getJobs = asyncHandler(async (req, res) => {
  const {
    status,
    department,
    projectId,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  const pageNumber = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageLimit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 10), 100);

  // Build filter
  const filter = {};
  
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  // Employees must never see soft-deleted jobs; admins see all
  if (!isAdminOrSuperAdmin) {
    filter.isSoftDeleted = { $ne: true };
  }
  if (status) filter.status = status;
  if (department) filter.department = new RegExp(department, "i");
  if (projectId) filter.projectId = projectId;
  if (search) {
    filter.$or = [
      { title: new RegExp(search, "i") },
      { postCode: new RegExp(search, "i") },
      { description: new RegExp(search, "i") },
    ];
  }

  // Build sort
  const sort = {};
  sort[JOB_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt"] =
    sortOrder === "desc" ? -1 : 1;

  // Execute query with pagination
  const skip = (pageNumber - 1) * pageLimit;
  const jobs = await Job.find(filter)
    .populate("projectId", "name department state status startDate endDate closureDate")
    .populate("createdBy", "fullName employeeId")
    .sort(sort)
    .skip(skip)
    .limit(pageLimit);

  const [total, applicationStats] = await Promise.all([
    Job.countDocuments(filter),
    jobs.length
      ? Application.aggregate([
          { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
          {
            $group: {
              _id: "$jobId",
              totalApplicants: { $sum: 1 },
              paidApplicants: {
                $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
              },
            },
          },
        ])
      : [],
  ]);

  const statsByJobId = new Map(
    applicationStats.map((row) => [String(row._id), row]),
  );
  const jobsWithStats = jobs.map((job) => {
    const stats = statsByJobId.get(String(job._id));
    return {
      ...withComputedProjectStatus(job),
      totalApplicants: stats?.totalApplicants || 0,
      paidApplicants: stats?.paidApplicants || 0,
    };
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Jobs fetched successfully", {
      jobs: jobsWithStats,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / pageLimit),
        totalItems: total,
        itemsPerPage: pageLimit,
      },
    }),
  );
});

/**
 * @swagger
 * /api/admin/jobs/{id}:
 *   get:
 *     summary: Get single job with full details
 *     tags: [Admin - Jobs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Job fetched successfully
 *       404:
 *         description: Job not found
 */
const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate("projectId", "name department state status startDate endDate closureDate")
    .populate("createdBy", "fullName employeeId department");

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  if (job.isSoftDeleted && !isAdminOrSuperAdmin) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  // Get application statistics
  const applicationStats = await Application.aggregate([
    { $match: { jobId: job._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const paymentStats = await Application.aggregate([
    { $match: { jobId: job._id } },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalFee" },
      },
    },
  ]);

  const jobWithStats = {
    ...withComputedProjectStatus(job),
    applicationStats,
    paymentStats,
  };

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job fetched successfully", {
      job: jobWithStats,
    }),
  );
});

/**
 * @swagger
 * /api/admin/jobs:
 *   post:
 *     summary: Create new job (draft)
 *     tags: [Admin - Jobs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, title, postCode, department]
 *             properties:
 *               projectId: { type: string }
 *               title: { type: string }
 *               postCode: { type: string }
 *               department: { type: string }
 *     responses:
 *       201:
 *         description: Job created successfully as draft
 *       404:
 *         description: Project not found
 *       409:
 *         description: Post code already exists
 */
const createJob = asyncHandler(async (req, res) => {
  const { projectId, title, postCode, department } = req.body;

  // Verify project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }
  const projectStatus = getProjectLifecycleStatus(project);
  if (["Completed", "Cancelled"].includes(projectStatus)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot create jobs under a completed or cancelled project",
    );
  }

  // Check if postCode is unique
  const existingJob = await Job.findOne({ postCode });
  if (existingJob) {
    throw new ApiError(StatusCodes.CONFLICT, "Post code already exists");
  }

  const job = await Job.create({
    projectId,
    title,
    postCode,
    department,
    createdBy: req.user.id,
    status: "draft",
  });

  await job.populate([
    { path: "projectId", select: "name department state status startDate endDate closureDate" },
    { path: "createdBy", select: "fullName employeeId" },
  ]);

  await invalidatePublicRecruitmentCache();

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_created",
    message: `New job "${title}" created as draft`,
    job: job.toObject(),
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.JOB_CREATED, {
    jobId: job._id,
    projectId: job.projectId?._id || job.projectId,
    job: job.toObject(),
    timestamp: new Date(),
  });

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Job created successfully as draft", {
      message: "Job created successfully as draft",
      job,
    }),
  );
});

/**
 * @swagger
 * /api/admin/jobs/{id}:
 *   put:
 *     summary: Update job
 *     tags: [Admin - Jobs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       400:
 *         description: Cannot update job with existing applications
 *       404:
 *         description: Job not found
 */
const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  if (
    req.body.projectId &&
    String(req.body.projectId) !== String(job.projectId)
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This job is already linked to another project. Open the correct project or create a new job.",
    );
  }
  delete req.body.projectId;

  await enforcePublishedJobEditPolicy({ job, body: req.body });

  if (Array.isArray(req.body.posts) && req.body.posts.length > 0) {
    const posts = normalizePosts(req.body.posts);
    if (posts.length === 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "At least one post/designation is required",
      );
    }

    const totalPostVacancies = getPostVacancyTotal(posts);
    if (totalPostVacancies < 1) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Total post vacancies must be at least 1",
      );
    }

    req.body.posts = posts;
    req.body.totalPosts = totalPostVacancies;
  } else if (Array.isArray(req.body.posts)) {
    req.body.posts = [];
    req.body.totalPosts = 0;
  }

  // Update job with provided fields — deep merge nested objects
  const project = await Project.findById(job.projectId);
  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const nextJob = job.toObject();
  Object.keys(req.body).forEach((key) => {
    if (
      req.body[key] !== undefined &&
      key !== "amendmentReason" &&
      key !== "posts" &&
      typeof req.body[key] === "object" &&
      !Array.isArray(req.body[key]) &&
      nextJob[key] &&
      typeof nextJob[key] === "object"
    ) {
      nextJob[key] = { ...nextJob[key], ...req.body[key] };
    } else if (req.body[key] !== undefined && key !== "amendmentReason") {
      nextJob[key] = req.body[key];
    }
  });
  if (job.status !== "draft") {
    assertJobTimeline(nextJob, project);
  }

  Object.keys(req.body).forEach((key) => {
    if (req.body[key] !== undefined && key !== "amendmentReason") {
      // For nested objects (applicationFee, paymentConfig, etc.), merge instead of replace
      if (
        key !== "posts" &&
        typeof req.body[key] === "object" &&
        !Array.isArray(req.body[key]) &&
        job[key] &&
        typeof job[key] === "object"
      ) {
        Object.keys(req.body[key]).forEach((subKey) => {
          job[key][subKey] = req.body[key][subKey];
        });
        job.markModified(key);
      } else {
        job[key] = req.body[key];
      }
    }
  });

  await job.save();
  await saveAuditLog(
    req,
    req.body.amendmentReason
      ? `Job amendment for "${job.title}": ${String(req.body.amendmentReason).trim()}`
      : `Updated job: ${job.title}`,
  );

  await job.populate([
    { path: "projectId", select: "name department state" },
    { path: "createdBy", select: "fullName employeeId" },
  ]);

  await invalidatePublicRecruitmentCache();

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_updated",
    message: `Job "${job.title}" updated`,
    job: job.toObject(),
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.JOB_UPDATED, {
    jobId: job._id,
    projectId: job.projectId?._id || job.projectId,
    job: job.toObject(),
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.JOB_UPDATED, {
    jobId: job._id,
    projectId: job.projectId?._id || job.projectId,
    status: job.status,
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job updated successfully", {
      message: "Job updated successfully",
      job,
    }),
  );
});

/**
 * @desc    Publish job (make it active)
 * @route   PUT /api/admin/jobs/:id/publish
 * @access  Private (Admin)
 */
const publishJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id).populate("projectId");

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  if (job.status !== "draft") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only draft jobs can be published",
    );
  }

  // Auto-compute totalPosts from posts array if available
  if (job.posts?.length) {
    const computed = getPostVacancyTotal(job.posts);
    if (computed > 0) job.totalPosts = computed;
  }

  const publishErrors = getPublishValidationErrors(job);
  if (publishErrors.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot publish job. Please fix: ${publishErrors.join("; ")}`,
    );
  }

  assertJobTimeline(job.toObject(), job.projectId);

  const deadline = endOfDay(job.applicationDeadline);
  if (deadline && new Date() > deadline) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot publish job. Application deadline has already passed. Update the deadline before publishing.",
    );
  }

  job.status = "active";
  job.publishedAt = new Date();
  await job.save();

  await saveAuditLog(req, "JOB_PUBLISHED", "Job published successfully", {
    jobId: job._id,
    title: job.title,
  });

  await job.populate([
    { path: "projectId", select: "name department state" },
    { path: "createdBy", select: "fullName employeeId" },
  ]);

  await invalidatePublicRecruitmentCache();

  // Real-time notifications
  emitToAdmins(SOCKET_EVENTS.JOB_PUBLISHED, {
    type: "job_published",
    message: `Job "${job.title}" has been published`,
    job: job.toObject(),
    timestamp: new Date(),
  });

  // Broadcast to public for new job notification
  emitBroadcast(SOCKET_EVENTS.JOB_PUBLISHED, {
    type: "new_job_available",
    message: `New job available: ${job.title}`,
    job: {
      _id: job._id,
      title: job.title,
      department: job.department,
      applicationDeadline: job.applicationDeadline,
    },
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job published successfully", {
      message: "Job published successfully",
      job,
    }),
  );
});

/**
 * @desc    Close job
 * @route   PUT /api/admin/jobs/:id/close
 * @access  Private (Admin)
 */
const closeJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  if (job.status !== "active") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only active jobs can be closed",
    );
  }

  job.status = "closed";
  await job.save();

  await invalidatePublicRecruitmentCache();

  // Real-time notifications
  emitToAdmins(SOCKET_EVENTS.JOB_CLOSED, {
    type: "job_closed",
    message: `Job "${job.title}" has been closed`,
    job: job.toObject(),
    timestamp: new Date(),
  });

  emitBroadcast(SOCKET_EVENTS.JOB_CLOSED, {
    type: "job_closed",
    message: `Application deadline passed for: ${job.title}`,
    jobId: job._id,
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job closed successfully", {
      message: "Job closed successfully",
      job,
    }),
  );
});

/**
 * @desc    Delete job
 * @route   DELETE /api/admin/jobs/:id
 * @access  Private (Admin)
 */
const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  }

  // Check if job has applications
  const applicationCount = await Application.countDocuments({ jobId: job._id });
  if (applicationCount > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot delete job with existing applications",
    );
  }

  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;

  if (!isAdminOrSuperAdmin) {
    // Soft delete: mark record as deleted — stays visible to admin/superadmin
    await Job.findByIdAndUpdate(req.params.id, {
      isSoftDeleted: true,
      deletedBy: req.user.id,
      deletedAt: new Date(),
    });
    await saveAuditLog(req, `Soft-deleted job: ${job.title}`);
    await notifyAdmins({
      type: "system_audit",
      title: "Job removal requested",
      message: `Employee removed job "${job.title}". It is hidden from employee views and still visible to admin/superadmin.`,
      link: "/admin/jobs",
      metadata: {
        action: "soft_delete",
        resource: "job",
        resourceId: String(job._id),
        actorId: String(req.user.id),
      },
    });
  } else {
    // Hard delete: reserved for admin/superadmin
    await Job.findByIdAndDelete(req.params.id);
    await Project.findByIdAndUpdate(job.projectId, { $inc: { totalJobs: -1 } });
    await saveAuditLog(req, `Deleted job: ${job.title}`);
  }

  await invalidatePublicRecruitmentCache();

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_deleted",
    message: `Job "${job.title}" deleted`,
    jobId: job._id,
    projectId: job.projectId,
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.JOB_UPDATED, {
    type: "job_deleted",
    jobId: job._id,
    projectId: job.projectId,
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.JOB_UPDATED, {
    type: "job_deleted",
    jobId: job._id,
    projectId: job.projectId,
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(
      StatusCodes.OK,
      isAdminOrSuperAdmin
        ? "Job deleted successfully"
        : "Job hidden from employee portal and admin notified",
      {
        message: isAdminOrSuperAdmin
          ? "Job deleted successfully"
          : "Job hidden from employee portal and admin notified",
        softDeleted: !isAdminOrSuperAdmin,
      },
    ),
  );
});

/**
 * @desc    Get job statistics
 * @route   GET /api/admin/jobs/stats
 * @access  Private (Admin)
 */
const getJobStats = asyncHandler(async (req, res) => {
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  const filter = isAdminOrSuperAdmin ? {} : { isSoftDeleted: { $ne: true } };
  const statusStats = await Job.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const departmentStats = await Job.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$department",
        count: { $sum: 1 },
        totalPosts: { $sum: "$totalPosts" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const recentJobs = await Job.find(filter)
    .populate("projectId", "name")
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title department status createdAt");

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job statistics fetched successfully", {
      statusStats,
      departmentStats,
      recentJobs,
    }),
  );
});

const getJobByPostCode = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ postCode: req.params.postCode }).lean();
  if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job fetched", { job }),
  );
});

module.exports = {
  getJobs,
  getJob,
  getJobByPostCode,
  createJob,
  updateJob,
  publishJob,
  closeJob,
  deleteJob,
  getJobStats,
};
