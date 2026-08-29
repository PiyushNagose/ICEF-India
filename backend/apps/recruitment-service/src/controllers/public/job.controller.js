const { StatusCodes } = require("http-status-codes");
const Job = require("../../shared/models/Job");
const Project = require("../../shared/models/Project");
const Application = require("../../shared/models/Application");
const ApiError = require("../../shared/utils/ApiError");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { startOfDay, endOfDay } = require("../../shared/utils/timeline");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getPublicListingFilter = (now = new Date()) => ({
  status: "active",
  isSoftDeleted: { $ne: true },
  $or: [
    { applicationDeadline: { $exists: false } },
    { applicationDeadline: null },
    { applicationDeadline: { $gte: startOfDay(now) } },
  ],
});

const JOB_SORT_FIELDS = new Set([
  "publishedAt",
  "applicationDeadline",
  "applicationStartDate",
  "totalPosts",
  "title",
]);

const getPublishedProjectIds = async (projectQuery = {}) =>
  Project.find({
    ...projectQuery,
    isPublished: true,
    status: { $ne: "Cancelled" },
  }).distinct("_id");

const appendAndFilter = (filter, clause) => {
  filter.$and = filter.$and || [];
  filter.$and.push(clause);
};

const buildAvailability = (jobLike, now = new Date()) => {
  const job = jobLike?.toObject ? jobLike.toObject() : jobLike || {};
  const currentDay = startOfDay(now);
  const start = startOfDay(job.applicationStartDate);
  const deadline = endOfDay(job.applicationDeadline);
  const deadlineDay = startOfDay(job.applicationDeadline);

  if (job.status === "closed") {
    return {
      status: "closed",
      label: "Closed",
      canApply: false,
      reason: "The application window for this post has ended.",
      daysLeft: 0,
    };
  }

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
    const daysUntilOpen = Math.max(
      0,
      Math.ceil((start - currentDay) / MS_PER_DAY),
    );
    return {
      status: "not_open",
      label: "Not Open Yet",
      canApply: false,
      reason: "Application window has not opened yet.",
      daysUntilOpen,
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
 * @desc    Get all active jobs (public)
 * @route   GET /api/jobs
 * @access  Public
 */
const getJobs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    department,
    category,
    state,
    search,
    sortBy = "publishedAt",
    sortOrder = "desc",
  } = req.query;

  const now = new Date();

  const filter = getPublicListingFilter(now);

  if (department) filter.department = new RegExp(department, "i");
  if (category) filter.category = category;

  const projectQuery = state ? { state: new RegExp(state, "i") } : {};
  filter.projectId = { $in: await getPublishedProjectIds(projectQuery) };

  if (search) {
    appendAndFilter(filter, {
      $or: [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { department: new RegExp(search, "i") },
      ],
    });
  }

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const safeSortBy = JOB_SORT_FIELDS.has(sortBy) ? sortBy : "publishedAt";

  // Build sort
  const sort = {};
  sort[safeSortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query with pagination
  const skip = (pageNumber - 1) * pageLimit;
  const jobs = await Job.find(filter)
    .populate("projectId", "name department state publicSlug")
    .select(
      "title postCode department category totalPosts posts salaryRange applicationStartDate applicationDeadline correctionStartDate correctionDeadline admitCardReleaseDate examDate resultDate workLocation publishedAt applicationFee status",
    )
    .sort(sort)
    .skip(skip)
    .limit(pageLimit)
    .lean();

  const [total, applicationCounts] = await Promise.all([
    Job.countDocuments(filter),
    jobs.length
      ? Application.aggregate([
          {
            $match: {
              jobId: { $in: jobs.map((job) => job._id) },
              status: { $ne: "draft" },
            },
          },
          { $group: { _id: "$jobId", total: { $sum: 1 } } },
        ])
      : [],
  ]);

  const countByJobId = new Map(
    applicationCounts.map((row) => [String(row._id), row.total]),
  );
  const jobsWithStats = jobs.map((job) => {
    const availability = buildAvailability(job, now);
    return {
      ...job,
      totalApplicants: countByJobId.get(String(job._id)) || 0,
      availability,
      daysLeft: availability.daysLeft,
      isApplicationOpen: availability.canApply,
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
 * @desc    Get single job details (public)
 * @route   GET /api/jobs/:id
 * @access  Public
 */
const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.id,
    status: { $in: ["active", "closed"] },
    isSoftDeleted: { $ne: true },
  }).populate("projectId", "name department state description publicSlug status isPublished");

  if (
    !job ||
    !job.projectId ||
    !job.projectId.isPublished ||
    job.projectId.status === "Cancelled"
  ) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Job not found or not available");
  }

  // Get application statistics
  const totalApplicants = await Application.countDocuments({
    jobId: job._id,
    status: { $ne: "draft" },
  });

  const categoryWiseApplicants = await Application.aggregate([
    {
      $match: {
        jobId: job._id,
        status: { $ne: "draft" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "candidateId",
        foreignField: "_id",
        as: "candidate",
      },
    },
    { $unwind: "$candidate" },
    {
      $group: {
        _id: "$candidate.category",
        count: { $sum: 1 },
      },
    },
  ]);

  const jobWithStats = {
    ...job.toObject(),
    totalApplicants,
    categoryWiseApplicants,
    availability: buildAvailability(job),
    daysLeft: buildAvailability(job).daysLeft,
    isApplicationOpen: buildAvailability(job).canApply,
  };

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job details fetched successfully", {
      job: jobWithStats,
    }),
  );
});

/**
 * @desc    Get job statistics for homepage
 * @route   GET /api/jobs/stats
 * @access  Public
 */
const getJobStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const publicListingFilter = getPublicListingFilter(now);
  publicListingFilter.projectId = { $in: await getPublishedProjectIds() };

  const totalActiveJobs = await Job.countDocuments(publicListingFilter);

  const totalVacancies = await Job.aggregate([
    { $match: publicListingFilter },
    { $group: { _id: null, total: { $sum: "$totalPosts" } } },
  ]);

  const departmentStats = await Job.aggregate([
    { $match: publicListingFilter },
    {
      $group: {
        _id: "$department",
        jobCount: { $sum: 1 },
        totalPosts: { $sum: "$totalPosts" },
      },
    },
    { $sort: { jobCount: -1 } },
    { $limit: 10 },
  ]);

  const upcomingDeadlines = await Job.find({
    ...publicListingFilter,
    applicationDeadline: {
      $gte: startOfDay(now),
      $lte: endOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
      ),
    },
  })
    .select("title department applicationDeadline projectId")
    .populate("projectId", "name state publicSlug")
    .sort({ applicationDeadline: 1 })
    .limit(5);

  const [totalApplications, activeProjectIds] = await Promise.all([
    Application.countDocuments({ status: { $ne: "draft" } }),
    Job.distinct("projectId", publicListingFilter),
  ]);
  const totalActiveProjects = activeProjectIds.filter(Boolean).length;

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Job statistics fetched successfully", {
      totalActiveJobs,
      totalVacancies: totalVacancies[0]?.total || 0,
      totalApplications,
      totalActiveProjects,
      departmentStats,
      upcomingDeadlines,
    }),
  );
});

/**
 * @desc    Search / eligibility-filter jobs
 * @route   GET /api/jobs/search
 * @access  Public
 *
 * Query params:
 *   q            – free-text search (title / dept / description)
 *   department   – department name (partial match)
 *   category     – job category enum
 *   qualification – "10th" | "12th" | "Graduation" | "Post Graduation"
 *   age          – candidate age (number); jobs whose ageLimit.min <= age <= ageLimit.max
 *   candidateCategory – "general" | "obc" | "sc" | "st" | "ews" | "pwd"
 *   page         – page number (default 1)
 *   limit        – results per page (default 20)
 */
const searchJobs = asyncHandler(async (req, res) => {
  const {
    q,
    department,
    category,
    qualification,
    age,
    candidateCategory,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = getPublicListingFilter(new Date());
  filter.projectId = { $in: await getPublishedProjectIds() };

  if (q) {
    appendAndFilter(filter, {
      $or: [
        { title: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { department: new RegExp(q, "i") },
        { postCode: new RegExp(q, "i") },
      ],
    });
  }

  if (department) filter.department = new RegExp(department, "i");
  if (category) filter.category = category;

  // ── Qualification hierarchy filter ────────────────────────
  // Map the candidate's highest qualification to a set of degree keywords
  // that would appear in job.education.essential[].degree.
  // A job is eligible if its minimum required degree is <= candidate's level.
  // We implement this by building an $or across all degree levels the candidate
  // meets OR by including jobs that have no education requirement set.
  if (qualification) {
    const qualLower = qualification.toLowerCase();
    // Degree keywords per level (cumulative — higher includes lower)
    const degreeKeywords = {
      "10th": ["10th", "matriculation", "sslc", "class x", "class 10"],
      "12th": [
        "10th",
        "matriculation",
        "sslc",
        "class x",
        "class 10",
        "12th",
        "intermediate",
        "hsc",
        "class xii",
        "class 12",
        "higher secondary",
      ],
      graduation: [
        "10th",
        "matriculation",
        "sslc",
        "class x",
        "class 10",
        "12th",
        "intermediate",
        "hsc",
        "class xii",
        "class 12",
        "higher secondary",
        "graduation",
        "graduate",
        "bachelor",
        "b.tech",
        "b.e",
        "b.sc",
        "b.com",
        "b.a",
        "b.ed",
        "llb",
        "mbbs",
        "degree",
      ],
      "post graduation": [
        "10th",
        "matriculation",
        "sslc",
        "class x",
        "class 10",
        "12th",
        "intermediate",
        "hsc",
        "class xii",
        "class 12",
        "higher secondary",
        "graduation",
        "graduate",
        "bachelor",
        "b.tech",
        "b.e",
        "b.sc",
        "b.com",
        "b.a",
        "b.ed",
        "llb",
        "mbbs",
        "degree",
        "post graduation",
        "postgraduate",
        "master",
        "m.tech",
        "m.sc",
        "m.com",
        "m.a",
        "mba",
        "phd",
        "doctorate",
      ],
    };

    const keywords = degreeKeywords[qualLower] || [];
    if (keywords.length > 0) {
      // Jobs whose essential degree matches any of the candidate's eligible keywords
      // OR jobs that have no essential education requirement at all
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { "education.essential": { $size: 0 } },
          { "education.essential": { $exists: false } },
          {
            "education.essential.degree": {
              $in: keywords.map((k) => new RegExp(k, "i")),
            },
          },
        ],
      });
    }
  }

  // ── Age filter ────────────────────────────────────────────
  // Include jobs where candidate age falls within ageLimit range
  // (accounting for category relaxation if candidateCategory provided)
  if (age && !isNaN(Number(age))) {
    const ageNum = Number(age);
    const catLower = (candidateCategory || "").toLowerCase();

    // Relaxation amounts by category (defaults)
    const relaxationMap = {
      sc: 5,
      st: 5,
      obc: 3,
      pwd: 10,
      ews: 0,
      general: 0,
    };
    const relaxation = relaxationMap[catLower] || 0;

    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        // No age limit set — always eligible
        { "ageLimit.min": { $exists: false } },
        { "ageLimit.max": { $exists: false } },
        {
          $and: [
            { "ageLimit.min": { $lte: ageNum } },
            // max + relaxation >= candidate age
            {
              $expr: {
                $gte: [{ $add: ["$ageLimit.max", relaxation] }, ageNum],
              },
            },
          ],
        },
      ],
    });
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .populate("projectId", "name state publicSlug")
      .select(
        "title postCode department category totalPosts applicationDeadline " +
          "applicationStartDate workLocation applicationFee ageLimit education salaryRange publishedAt status",
      )
      .sort({ applicationDeadline: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Job.countDocuments(filter),
  ]);

  // Attach daysLeft and compute fee for the requested category
  const jobsWithMeta = jobs.map((job) => {
    const obj = job.toObject();
    const availability = buildAvailability(obj);
    obj.daysLeft = obj.applicationDeadline
      ? availability.daysLeft
      : null;
    obj.availability = availability;
    obj.isApplicationOpen = obj.availability.canApply;

    // Compute applicable fee for the candidate's category
    const fee = obj.applicationFee || {};
    const catLower = (candidateCategory || "general").toLowerCase();
    let applicableFee = fee.general || 0;
    if (catLower === "sc" || catLower === "st")
      applicableFee = fee.scSt ?? fee.scst ?? 0;
    else if (catLower === "obc") applicableFee = fee.obc ?? fee.general ?? 0;
    else if (catLower === "ews") applicableFee = fee.ews ?? fee.general ?? 0;
    else if (catLower === "pwd") applicableFee = fee.pwd ?? 0;
    obj.applicableFee = applicableFee;

    return obj;
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Jobs found", {
      jobs: jobsWithMeta,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    }),
  );
});

/**
 * @desc    Get departments list
 * @route   GET /api/jobs/departments
 * @access  Public
 */
const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Job.distinct(
    "department",
    getPublicListingFilter(new Date()),
  );

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Departments fetched", {
      departments: departments.sort(),
    }),
  );
});

/**
 * @desc    Get categories list
 * @route   GET /api/jobs/categories
 * @access  Public
 */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Job.distinct(
    "category",
    getPublicListingFilter(new Date()),
  );

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Categories fetched", {
      categories: categories.sort(),
    }),
  );
});

module.exports = {
  getJobs,
  getJob,
  getJobStats,
  searchJobs,
  getDepartments,
  getCategories,
};
