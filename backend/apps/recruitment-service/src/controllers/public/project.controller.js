const { StatusCodes } = require("http-status-codes");
const Project = require("../../shared/models/Project");
const Job = require("../../shared/models/Job");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const ApiError = require("../../shared/utils/ApiError");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { getRedis } = require("../../shared/config/redis");
const { getProjectLifecycleStatus } = require("../../shared/utils/timeline");

const CACHE_TTL = 5 * 60; // 5 minutes

/**
 * GET /api/public/projects/:slug
 * Public landing page data — project + all its active jobs
 */
const getProjectBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const redis = getRedis();
  const cacheKey = `public:project:${slug}`;

  // Try cache first
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(StatusCodes.OK).json(JSON.parse(cached));
    }
  }

  const project = await Project.findOne({ publicSlug: slug })
    .select("-createdBy -__v")
    .lean();

  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Recruitment not found");
  }

  const jobs = await Job.find({ projectId: project._id, status: "active" })
    .select(
      "title postCode department category totalPosts posts salaryRange " +
        "applicationFee applicationStartDate applicationDeadline correctionStartDate " +
        "correctionDeadline admitCardReleaseDate examDate resultDate ageLimit " +
        "education physicalStandards description",
    )
    .sort({ createdAt: 1 })
    .lean();

  const now = new Date();
  const enrichedJobs = jobs.map((job) => ({
    ...job,
    isApplicationOpen:
      job.applicationStartDate <= now && job.applicationDeadline >= now,
    daysLeft: job.applicationDeadline
      ? Math.max(
          0,
          Math.ceil((new Date(job.applicationDeadline) - now) / 86400000),
        )
      : null,
    isCorrectionOpen:
      job.correctionStartDate &&
      job.correctionDeadline &&
      job.correctionStartDate <= now &&
      job.correctionDeadline >= now,
    isAdmitCardAvailable:
      job.admitCardReleaseDate && job.admitCardReleaseDate <= now,
  }));

  const payload = new ApiResponse(
    StatusCodes.OK,
    "Project fetched successfully",
    { project, jobs: enrichedJobs },
  );

  // Cache the response
  if (redis) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));
  }

  res.status(StatusCodes.OK).json(payload);
});

/**
 * GET /api/public/projects
 * List all active projects (for a portal-wide listing page)
 */
const getActiveProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, state, department, search } = req.query;
  const redis = getRedis();
  const cacheKey = `public:projects:${JSON.stringify(req.query)}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(StatusCodes.OK).json(JSON.parse(cached));
    }
  }

  const filter = { status: { $ne: "Cancelled" } };
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
  const activeProjects = (
    await Promise.all(
      lifecycleActiveProjects.map(async (project) => {
        const activeJobCount = await Job.countDocuments({
          projectId: project._id,
          status: "active",
        });
        if (!activeJobCount) return null;
        return {
          ...project,
          totalJobs: activeJobCount,
        };
      }),
    )
  ).filter(Boolean);
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

  if (redis) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));
  }

  res.status(StatusCodes.OK).json(payload);
});

module.exports = { getProjectBySlug, getActiveProjects };
