const { StatusCodes } = require("http-status-codes");
const Project = require("../../shared/models/Project");
const Job = require("../../shared/models/Job");
const Application = require("../../shared/models/Application");
const StateBanner = require("../../shared/models/StateBanner");
const ApiError = require("../../shared/utils/ApiError");
const { ApiResponse, paginationMeta } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");
const { getPaginationParams } = require("../../shared/utils/helpers");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const {
  assertProjectTimeline,
  getProjectLifecycleStatus,
} = require("../../shared/utils/timeline");
const {
  invalidatePublicRecruitmentCache,
} = require("../../shared/utils/publicCache");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");
const {
  PUBLIC_JOB_FIELDS,
  enrichPublicJob,
} = require("../../shared/utils/publicProjectView");

const withProjectLifecycleStatus = (project) => {
  const plain = typeof project.toObject === "function" ? project.toObject() : project;
  return {
    ...plain,
    status: getProjectLifecycleStatus(plain),
  };
};

const isJobAdvertisementConfigured = (job) => {
  const posts = Array.isArray(job?.posts) ? job.posts : [];
  const hasVacancies =
    Number(job?.totalPosts || 0) > 0 ||
    posts.some((post) => Number(post?.vacancies || 0) > 0);

  return Boolean(
    job?.title &&
      job?.postCode &&
      job?.department &&
      hasVacancies &&
      job?.applicationStartDate &&
      job?.applicationDeadline,
  );
};

/**
 * @desc    Get all projects with stats
 * @route   GET /api/admin/projects
 * @access  Private (Admin)
 */
const getProjects = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    department,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter
  const filter = {};
  
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  // Employees must never see soft-deleted projects; admins see all
  if (!isAdminOrSuperAdmin) {
    filter.isSoftDeleted = { $ne: true };
  }
  if (status === "Cancelled") filter.status = status;
  if (department) filter.department = new RegExp(department, "i");
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { description: new RegExp(search, "i") },
    ];
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const projects = await Project.find(filter)
    .populate("createdBy", "fullName employeeId")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Project.countDocuments(filter);

  // Calculate stats for each project
  const projectsWithStats = await Promise.all(
    projects.map(async (project) => {
      const jobStatsFilter = { projectId: project._id };
      if (!isAdminOrSuperAdmin) jobStatsFilter.isSoftDeleted = { $ne: true };
      const jobs = await Job.countDocuments(jobStatsFilter);
      const applications = await Application.countDocuments({
        jobId: {
          $in: await Job.find(jobStatsFilter).distinct("_id"),
        },
      });

      return {
        ...withProjectLifecycleStatus(project),
        totalJobs: jobs,
        totalApplicants: applications,
      };
    }),
  );

  const filteredProjectsWithStats =
    status && status !== "Cancelled"
      ? projectsWithStats.filter((project) => project.status === status)
      : projectsWithStats;

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Projects fetched successfully", {
      projects: filteredProjectsWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: status && status !== "Cancelled" ? filteredProjectsWithStats.length : total,
        itemsPerPage: parseInt(limit),
      },
    }),
  );
});

/**
 * @desc    Get single project with detailed stats
 * @route   GET /api/admin/projects/:id
 * @access  Private (Admin)
 */
const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate(
    "createdBy",
    "fullName employeeId department",
  );

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  if (project.isSoftDeleted && !isAdminOrSuperAdmin) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  // Get detailed stats
  const jobFilter = { projectId: project._id };
  if (!isAdminOrSuperAdmin) jobFilter.isSoftDeleted = { $ne: true };
  const jobs = await Job.find(jobFilter)
    .select(
      "title postCode department category status totalPosts posts applicationFee " +
        "applicationStartDate applicationDeadline paymentConfig createdAt",
    )
    .sort({ createdAt: -1 });
  const cmsPage = await StateBanner.findOne({ projectId: project._id })
    .select("status updatedAt")
    .lean();
  const landingComplete = cmsPage?.status === "published";
  const configuredJobCount = jobs.filter(isJobAdvertisementConfigured).length;
  const activeJobCount = jobs.filter((job) => job.status === "active").length;

  const totalApplications = await Application.countDocuments({
    jobId: { $in: jobs.map((job) => job._id) },
  });

  const paidApplications = await Application.countDocuments({
    jobId: { $in: jobs.map((job) => job._id) },
    paymentStatus: "paid",
  });

  const applicationStatsByJob = await Application.aggregate([
    {
      $match: {
        jobId: { $in: jobs.map((job) => job._id) },
      },
    },
    {
      $group: {
        _id: "$jobId",
        totalApplicants: { $sum: 1 },
        paidApplicants: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
        },
      },
    },
  ]);
  const applicationStatsMap = new Map(
    applicationStatsByJob.map((item) => [
      String(item._id),
      {
        totalApplicants: item.totalApplicants || 0,
        paidApplicants: item.paidApplicants || 0,
      },
    ]),
  );
  const jobsWithStats = jobs.map((job) => {
    const stats = applicationStatsMap.get(String(job._id)) || {
      totalApplicants: 0,
      paidApplicants: 0,
    };
    return {
      ...job.toObject(),
      ...stats,
    };
  });

  const revenue = await Application.aggregate([
    {
      $match: {
        jobId: { $in: jobs.map((job) => job._id) },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalFee" },
      },
    },
  ]);

  const projectStats = {
    ...withProjectLifecycleStatus(project),
    jobs: jobsWithStats,
    cmsStatus: cmsPage?.status || "draft",
    workflowReadiness: {
      complete: Boolean(project.isPublished && landingComplete && activeJobCount > 0),
      checks: [
        {
          key: "landing",
          label: "Landing CMS",
          complete: landingComplete,
        },
        {
          key: "job",
          label: "Job Advertisement",
          complete: configuredJobCount > 0 || activeJobCount > 0,
        },
        {
          key: "admit-format",
          label: "Admit Format",
          complete: false,
          optional: true,
        },
        {
          key: "centers",
          label: "Centers",
          complete: false,
          optional: true,
        },
        {
          key: "review",
          label: "Final Review",
          complete: Boolean(landingComplete && (configuredJobCount > 0 || activeJobCount > 0)),
          optional: true,
        },
        {
          key: "publish",
          label: "Publish / Verify",
          complete: Boolean(project.isPublished && activeJobCount > 0),
          optional: true,
        },
      ],
    },
    totalJobs: jobs.length,
    totalApplicants: totalApplications,
    paidApplicants: paidApplications,
    totalRevenue: revenue[0]?.totalRevenue || 0,
    conversionRate:
      totalApplications > 0 ? (paidApplications / totalApplications) * 100 : 0,
  };

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Project fetched successfully", {
      project: projectStats,
    }),
  );
});

/**
 * @desc    Create new project
 * @route   POST /api/admin/projects
 * @access  Private (Admin)
 */
const createProject = asyncHandler(async (req, res) => {
  const { name, description, department, state, startDate, endDate, isPublished } = req.body;
  assertProjectTimeline({ startDate, endDate });

  const project = await Project.create({
    name,
    description,
    department,
    state,
    startDate,
    endDate,
    isPublished: isPublished || false,
    createdBy: req.user.id,
  });

  await project.populate("createdBy", "fullName employeeId");

  await invalidatePublicRecruitmentCache();

  // Real-time notification to all admins
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "project_created",
    message: `New project "${name}" created by ${req.user.fullName || req.user.email}`,
    project: project.toObject(),
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.PROJECT_CREATED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.PROJECT_CREATED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Project created successfully", {
      message: "Project created successfully",
      project,
    }),
  );
});

/**
 * @desc    Update project
 * @route   PUT /api/admin/projects/:id
 * @access  Private (Admin)
 */
const updateProject = asyncHandler(async (req, res) => {
  const { name, description, department, state, status, startDate, endDate, closureDate, isPublished } =
    req.body;
  const nextEndDate = endDate !== undefined ? endDate : closureDate;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  assertProjectTimeline({
    startDate: startDate !== undefined ? startDate : project.startDate,
    endDate: nextEndDate !== undefined ? nextEndDate : project.endDate,
  });

  if (nextEndDate !== undefined) {
    const newEndDate = new Date(nextEndDate);
    const childJobs = await Job.find({ projectId: project._id });
    for (const j of childJobs) {
      if (j.resultDate && new Date(j.resultDate) > newEndDate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Cannot shrink project end date before job "${j.title}" result date.`);
      }
      if (j.examDate && new Date(j.examDate) > newEndDate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Cannot shrink project end date before job "${j.title}" exam date.`);
      }
      if (j.applicationDeadline && new Date(j.applicationDeadline) > newEndDate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Cannot shrink project end date before job "${j.title}" application deadline.`);
      }
    }
  }

  // Update fields
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (department !== undefined) project.department = department;
  if (state !== undefined) project.state = state;
  if (status !== undefined) project.status = status;
  if (startDate !== undefined) project.startDate = startDate;
  if (nextEndDate !== undefined) {
    project.endDate = nextEndDate;
    project.closureDate = nextEndDate;
  }
  if (isPublished !== undefined) project.isPublished = isPublished;

  await project.save();
  await saveAuditLog(req, `Updated project: ${project.name}`);
  await project.populate("createdBy", "fullName employeeId");

  await invalidatePublicRecruitmentCache();

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "project_updated",
    message: `Project "${project.name}" updated`,
    project: project.toObject(),
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.PROJECT_UPDATED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.PROJECT_UPDATED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Project updated successfully", {
      message: "Project updated successfully",
      project,
    }),
  );
});

/**
 * @desc    Publish project public URL
 * @route   PUT /api/admin/projects/:id/publish
 * @access  Private (Admin)
 */
const publishProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const activeJobCount = await Job.countDocuments({
    projectId: project._id,
    status: "active",
  });

  if (activeJobCount === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Publish at least one job before releasing the project URL",
    );
  }

  project.status = "Active";
  project.isPublished = true;
  project.publishedAt = project.publishedAt || new Date();

  await project.save();
  await saveAuditLog(req, `Published project URL: ${project.name}`);
  await invalidatePublicRecruitmentCache();

  emitToAdmins(SOCKET_EVENTS.PROJECT_UPDATED, {
    type: "project_published",
    message: `Project "${project.name}" public URL is live`,
    projectId: project._id,
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.PROJECT_UPDATED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Project public URL published", {
      message: "Project public URL published",
      project,
    }),
  );
});

/**
 * @desc    Delete project (soft delete for employees, hard delete for admin)
 * @route   DELETE /api/admin/projects/:id
 * @access  Private (Admin)
 */
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  const deleteBlockFilter = { projectId: project._id };
  if (!isAdminOrSuperAdmin) deleteBlockFilter.isSoftDeleted = { $ne: true };
  const jobCount = await Job.countDocuments(deleteBlockFilter);
  if (jobCount > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot delete project with existing jobs. Please delete all jobs first.",
    );
  }

  if (!isAdminOrSuperAdmin) {
    // Soft delete: mark record as deleted — stays visible to admin/superadmin
    await Project.findByIdAndUpdate(req.params.id, {
      isSoftDeleted: true,
      deletedBy: req.user.id,
      deletedAt: new Date(),
    });
    await saveAuditLog(req, `Soft-deleted project: ${project.name}`);
    await notifyAdmins({
      type: "system_audit",
      title: "Project removal requested",
      message: `Employee removed project "${project.name}". It is hidden from employee views and still visible to admin/superadmin.`,
      link: `/admin/projects/${project._id}`,
      metadata: {
        action: "soft_delete",
        resource: "project",
        resourceId: String(project._id),
        actorId: String(req.user.id),
      },
    });
  } else {
    // Hard delete: reserved for admin/superadmin
    await Project.findByIdAndDelete(req.params.id);
    await saveAuditLog(req, `Deleted project: ${project.name}`);
  }

  await invalidatePublicRecruitmentCache();

  // Real-time notification
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "project_deleted",
    message: `Project "${project.name}" deleted`,
    projectId: project._id,
    timestamp: new Date(),
  });
  emitToAdmins(SOCKET_EVENTS.PROJECT_DELETED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });
  emitBroadcast(SOCKET_EVENTS.PROJECT_DELETED, {
    projectId: project._id,
    project: project.toObject(),
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(
      StatusCodes.OK,
      isAdminOrSuperAdmin
        ? "Project deleted successfully"
        : "Project hidden from employee portal and admin notified",
      {
        message: isAdminOrSuperAdmin
          ? "Project deleted successfully"
          : "Project hidden from employee portal and admin notified",
        softDeleted: !isAdminOrSuperAdmin,
      },
    ),
  );
});

/**
 * @desc    Get project statistics
 * @route   GET /api/admin/projects/stats
 * @access  Private (Admin)
 */
const getProjectStats = asyncHandler(async (req, res) => {
  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  const filter = isAdminOrSuperAdmin ? {} : { isSoftDeleted: { $ne: true } };
  const allProjects = await Project.find(filter).select(
    "status startDate endDate closureDate totalRevenue",
  );
  const statsMap = allProjects.reduce((acc, project) => {
    const lifecycleStatus = getProjectLifecycleStatus(project);
    acc[lifecycleStatus] = acc[lifecycleStatus] || {
      _id: lifecycleStatus,
      count: 0,
      totalRevenue: 0,
    };
    acc[lifecycleStatus].count += 1;
    acc[lifecycleStatus].totalRevenue += Number(project.totalRevenue || 0);
    return acc;
  }, {});
  const stats = Object.values(statsMap);

  const departmentStats = await Project.aggregate([
    {
      $group: {
        _id: "$department",
        count: { $sum: 1 },
        totalJobs: { $sum: "$totalJobs" },
        totalApplicants: { $sum: "$totalApplicants" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Project statistics fetched successfully", {
      statusStats: stats,
      departmentStats,
    }),
  );
});

/**
 * @desc    Preview the public landing page before it goes live
 * @route   GET /api/admin/projects/:id/preview
 * @access  Private (Admin)
 *
 * Mirrors the public GET /api/public/projects/:slug payload, but without the
 * isPublished / cmsStatus="published" gates, so admins can verify the exact
 * public page before publishing. Draft jobs are included and shown as-if-open
 * (for availability rendering) while keeping their true status + a pending flag.
 */
const getProjectPreview = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .select("-createdBy -__v")
    .lean();

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const isAdminOrSuperAdmin = req.user.role === "admin" || req.user.isSuperAdmin;
  if (project.isSoftDeleted && !isAdminOrSuperAdmin) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  }

  const jobs = await Job.find({
    projectId: project._id,
    status: { $in: ["active", "draft"] },
    isSoftDeleted: { $ne: true },
  })
    .select(PUBLIC_JOB_FIELDS)
    .sort({ createdAt: 1 })
    .lean();

  const now = new Date();
  const enrichedJobs = jobs.map((job) => {
    const isLive = String(job.status || "").toLowerCase() === "active";
    // Draft jobs are enriched as-if active so the preview shows their real
    // availability window, but we restore the true status + flag them pending.
    const enriched = enrichPublicJob(isLive ? job : { ...job, status: "active" }, now);
    return isLive
      ? enriched
      : { ...enriched, status: job.status, previewPending: true };
  });

  const cmsPage = await StateBanner.findOne({ projectId: project._id })
    .populate(
      "featuredJobs",
      "title postCode department totalPosts applicationDeadline applicationFee status",
    )
    .lean();

  const liveJobCount = enrichedJobs.filter((job) => !job.previewPending).length;
  const pendingJobCount = enrichedJobs.length - liveJobCount;

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Project preview fetched", {
      project: withProjectLifecycleStatus(project),
      jobs: enrichedJobs,
      cmsPage,
      preview: {
        projectPublished: Boolean(project.isPublished),
        cmsStatus: cmsPage?.status || "draft",
        liveJobCount,
        pendingJobCount,
      },
    }),
  );
});

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  publishProject,
  deleteProject,
  getProjectStats,
  getProjectPreview,
};
