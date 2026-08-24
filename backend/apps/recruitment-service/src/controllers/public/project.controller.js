const { StatusCodes } = require("http-status-codes");
const Project = require("../../shared/models/Project");
const Job = require("../../shared/models/Job");
const StateBanner = require("../../shared/models/StateBanner");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const ApiError = require("../../shared/utils/ApiError");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { getRedis } = require("../../shared/config/redis");
const {
  getProjectLifecycleStatus,
  startOfDay,
  endOfDay,
} = require("../../shared/utils/timeline");

const CACHE_TTL = 10; // keep public pages fresh after admin publishing changes
const PUBLIC_JOB_FILTER = { status: "active" };
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getVisibleJobFilter = (now = new Date()) => ({
  status: "active",
  $or: [
    { applicationDeadline: { $exists: false } },
    { applicationDeadline: null },
    { applicationDeadline: { $gte: startOfDay(now) } },
  ],
});

const safeCacheGet = async (redis, key) => {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (error) {
    console.warn(`[PUBLIC] Cache read skipped for ${key}: ${error.message}`);
    return null;
  }
};

const safeCacheSet = async (redis, key, ttl, payload) => {
  if (!redis) return;
  try {
    await redis.setex(key, ttl, JSON.stringify(payload));
  } catch (error) {
    console.warn(`[PUBLIC] Cache write skipped for ${key}: ${error.message}`);
  }
};

const buildAvailability = (job, now = new Date()) => {
  const currentDay = startOfDay(now);
  const start = startOfDay(job.applicationStartDate);
  const deadline = endOfDay(job.applicationDeadline);
  const deadlineDay = startOfDay(job.applicationDeadline);

  if (job.status !== "active") {
    return {
      status: "inactive",
      label: "Inactive",
      canApply: false,
      reason: "This recruitment is not accepting applications.",
      daysLeft: null,
    };
  }
  if (start && currentDay < start) {
    return {
      status: "not_open",
      label: "Not Open Yet",
      canApply: false,
      reason: "Application window has not opened yet.",
      daysUntilOpen: Math.max(0, Math.ceil((start - currentDay) / MS_PER_DAY)),
      daysLeft: deadlineDay
        ? Math.max(0, Math.ceil((deadlineDay - currentDay) / MS_PER_DAY) + 1)
        : null,
    };
  }
  if (deadline && now > deadline) {
    return {
      status: "closed",
      label: "Closed",
      canApply: false,
      reason: "Application deadline has passed.",
      daysLeft: 0,
    };
  }
  return {
    status: "open",
    label: "Open",
    canApply: true,
    reason: "Applications are open.",
    daysLeft: deadlineDay
      ? Math.max(0, Math.ceil((deadlineDay - currentDay) / MS_PER_DAY) + 1)
      : null,
  };
};

/**
 * GET /api/public/projects/:slug
 * Public landing page data — project + all its active jobs
 */
const getProjectBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const redis = getRedis();
  const cacheKey = `public:v3:project:${slug}`;

  // Try cache first
  const cached = await safeCacheGet(redis, cacheKey);
  if (cached) {
    return res.status(StatusCodes.OK).json(JSON.parse(cached));
  }

  const project = await Project.findOne({
    publicSlug: slug,
    isPublished: true,
    status: { $ne: "Cancelled" },
  })
    .select("-createdBy -__v")
    .lean();

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Recruitment not found");
  }

  const jobs = await Job.find({ projectId: project._id, ...PUBLIC_JOB_FILTER })
    .select(
      "title postCode department category totalPosts posts salaryRange " +
        "applicationFee applicationStartDate applicationDeadline correctionStartDate " +
        "correctionDeadline admitCardReleaseDate examDate resultDate ageLimit " +
        "education physicalStandards medicalStandards description status",
    )
    .sort({ createdAt: 1 })
    .lean();

  const now = new Date();
  const enrichedJobs = jobs.map((job) => {
      const availability = buildAvailability(job, now);
      return {
        ...job,
        availability,
        isApplicationOpen: availability.canApply,
        daysLeft: availability.daysLeft,
        isCorrectionOpen:
          job.correctionStartDate &&
          job.correctionDeadline &&
          startOfDay(job.correctionStartDate) <= startOfDay(now) &&
          endOfDay(job.correctionDeadline) >= now,
        isAdmitCardAvailable:
          job.admitCardReleaseDate &&
          startOfDay(job.admitCardReleaseDate) <= startOfDay(now),
      };
    });

  const cmsPage = await StateBanner.findOne({
    projectId: project._id,
    status: "published",
  })
    .populate("featuredJobs", "title postCode department totalPosts applicationDeadline applicationFee status")
    .lean();

  const payload = new ApiResponse(
    StatusCodes.OK,
    "Project fetched successfully",
    { project, jobs: enrichedJobs, cmsPage },
  );

  // Cache the response
  await safeCacheSet(redis, cacheKey, CACHE_TTL, payload);

  res.status(StatusCodes.OK).json(payload);
});

/**
 * GET /api/public/projects
 * List all active projects (for a portal-wide listing page)
 */
const getActiveProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, state, department, search } = req.query;
  const redis = getRedis();
  const cacheKey = `public:v3:projects:${JSON.stringify(req.query)}`;

  const cached = await safeCacheGet(redis, cacheKey);
  if (cached) {
    return res.status(StatusCodes.OK).json(JSON.parse(cached));
  }

  const filter = { status: { $ne: "Cancelled" }, isPublished: true };
  if (state) filter.state = new RegExp(state, "i");
  if (department) filter.department = new RegExp(department, "i");
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { department: new RegExp(search, "i") },
      { description: new RegExp(search, "i") },
    ];
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const [allProjects] = await Promise.all([
    Project.find(filter)
      .select(
        "name description department state status startDate endDate publicSlug totalJobs totalApplicants",
      )
      .sort({ startDate: -1 })
      .lean(),
  ]);

  const lifecycleActiveProjects = allProjects
    .map((project) => ({
      ...project,
      status: getProjectLifecycleStatus(project),
    }))
    .filter((project) => project.status === "Active");

  const projectIds = lifecycleActiveProjects.map((project) => project._id);
  const now = new Date();
  const visibleJobFilter = getVisibleJobFilter(now);
  const jobCounts = projectIds.length
    ? await Job.aggregate([
        {
          $match: {
            projectId: { $in: projectIds },
            ...visibleJobFilter,
          },
        },
        {
          $group: {
            _id: "$projectId",
            totalJobs: { $sum: 1 },
            totalPosts: { $sum: "$totalPosts" },
            nearestDeadline: { $min: "$applicationDeadline" },
          },
        },
      ])
    : [];
  const countByProjectId = new Map(
    jobCounts.map((item) => [String(item._id), item]),
  );

  const activeProjects = lifecycleActiveProjects
    .map((project) => {
      const count = countByProjectId.get(String(project._id));
      return {
        ...project,
        totalJobs: count?.totalJobs || 0,
        openJobs: count?.totalJobs || 0,
        totalPosts: count?.totalPosts || 0,
        nearestDeadline: count?.nearestDeadline || null,
      };
    })
    .filter((project) => project.totalJobs > 0);
  const total = activeProjects.length;
  const skip = (requestedPage - 1) * requestedLimit;
  const projects = activeProjects.slice(skip, skip + requestedLimit);

  const payload = new ApiResponse(
    StatusCodes.OK,
    "Projects fetched successfully",
    {
      projects,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / requestedLimit),
        totalItems: total,
        itemsPerPage: requestedLimit,
      },
    },
  );

  await safeCacheSet(redis, cacheKey, CACHE_TTL, payload);

  res.status(StatusCodes.OK).json(payload);
});

module.exports = { getProjectBySlug, getActiveProjects };
