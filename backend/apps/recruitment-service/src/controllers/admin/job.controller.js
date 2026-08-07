const { StatusCodes } = require("http-status-codes");
const Job = require("../../shared/models/Job");
const Project = require("../../shared/models/Project");
const Application = require("../../shared/models/Application");
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
} = require("../../shared/utils/timeline");

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
    page = 1,
    limit = 10,
    status,
    department,
    projectId,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter
  const filter = {};
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
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const jobs = await Job.find(filter)
    .populate("projectId", "name department state status startDate endDate closureDate")
    .populate("createdBy", "fullName employeeId")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(filter);

  // Get application counts for each job
  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const applicationCount = await Application.countDocuments({
        jobId: job._id,
      });
      const paidCount = await Application.countDocuments({
        jobId: job._id,
        paymentStatus: "paid",
      });

      return {
        ...withComputedProjectStatus(job),
        totalApplicants: applicationCount,
        paidApplicants: paidCount,
      };
    }),
  );

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Jobs fetched successfully", {
      jobs: jobsWithStats,
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

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_created",
    message: `New job "${title}" created as draft`,
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

  // Don't allow updates to published jobs with applications
  if (job.status === "active") {
    const applicationCount = await Application.countDocuments({
      jobId: job._id,
    });
    if (applicationCount > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot update job with existing applications",
      );
    }
  }

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
  const project = await Project.findById(req.body.projectId || job.projectId);
  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const nextJob = job.toObject();
  Object.keys(req.body).forEach((key) => {
    if (
      req.body[key] !== undefined &&
      key !== "posts" &&
      typeof req.body[key] === "object" &&
      !Array.isArray(req.body[key]) &&
      nextJob[key] &&
      typeof nextJob[key] === "object"
    ) {
      nextJob[key] = { ...nextJob[key], ...req.body[key] };
    } else if (req.body[key] !== undefined) {
      nextJob[key] = req.body[key];
    }
  });
  if (job.status !== "draft") {
    assertJobTimeline(nextJob, project);
  }

  Object.keys(req.body).forEach((key) => {
    if (req.body[key] !== undefined) {
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
  await job.populate([
    { path: "projectId", select: "name department state" },
    { path: "createdBy", select: "fullName employeeId" },
  ]);

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_updated",
    message: `Job "${job.title}" updated`,
    job: job.toObject(),
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

  job.status = "active";
  job.publishedAt = new Date();
  await job.save();

  await job.populate([
    { path: "projectId", select: "name department state" },
    { path: "createdBy", select: "fullName employeeId" },
  ]);

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

  await Job.findByIdAndDelete(req.params.id);

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_deleted",
    message: `Job "${job.title}" deleted`,
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job deleted successfully", {
      message: "Job deleted successfully",
    }),
  );
});

/**
 * @desc    Get job statistics
 * @route   GET /api/admin/jobs/stats
 * @access  Private (Admin)
 */
const getJobStats = asyncHandler(async (req, res) => {
  const statusStats = await Job.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const departmentStats = await Job.aggregate([
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

  const recentJobs = await Job.find()
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
