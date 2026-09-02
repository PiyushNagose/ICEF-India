const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const Application = require("../../shared/models/Application");
const Job = require("../../shared/models/Job");
const Project = require("../../shared/models/Project");
const User = require("../../shared/models/User");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { getRedis } = require("../../shared/config/redis");

const CACHE_TTL = 300; // 5 minutes cache for expensive queries

const fetchWithCache = async (cacheKey, fetcher, reqQuery) => {
  // If there are specific date filters, maybe don't cache or cache separately,
  // but for dashboard mostly it's today or all-time. We'll cache based on the query string.
  const redisClient = getRedis();
  const fullKey = `analytics:${cacheKey}:${JSON.stringify(reqQuery)}`;

  if (redisClient) {
    try {
      const cached = await redisClient.get(fullKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn("Redis get error:", err.message);
    }
  }

  const data = await fetcher();

  if (redisClient) {
    try {
      await redisClient.set(fullKey, JSON.stringify(data), "EX", CACHE_TTL);
    } catch (err) {
      console.warn("Redis set error:", err.message);
    }
  }
  return data;
};

const buildDateFilter = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return {};

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return {};

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { createdAt: { $gte: start, $lte: end } };
};

/**
 * @swagger
 * /api/admin/analytics/overview:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard overview statistics
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Overview stats
 */
const getOverview = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = buildDateFilter({ startDate, endDate });

  const data = await fetchWithCache('overview', async () => {
    const [
      jobStatusCounts,
      projectStatusCounts,
      totalApplications,
      totalCandidates,
      applicationsByStatus,
      paymentStats,
    ] = await Promise.all([
      // Job counts by status (excludes soft-deleted by default)
      Job.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } },
      ]),
      // Project counts by status
      Project.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.countDocuments(dateFilter),
      User.countDocuments(dateFilter),
      Application.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { ...dateFilter, paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalFee" },
            totalPaidApplications: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Also count soft-deleted jobs separately for admin visibility
    const inactiveJobs = await Job.countDocuments({ isDeleted: true });

    return {
      jobStatusCounts,
      projectStatusCounts,
      totalApplications,
      totalCandidates,
      applicationsByStatus,
      paymentStats,
      inactiveJobs
    };
  }, req.query);

  const {
    jobStatusCounts,
    projectStatusCounts,
    totalApplications,
    totalCandidates,
    applicationsByStatus,
    paymentStats,
    inactiveJobs
  } = data;

  const jobCount = (status) =>
    jobStatusCounts.find((s) => s._id === status)?.count || 0;
  const projectCount = (status) =>
    projectStatusCounts.find((s) => s._id === status)?.count || 0;

  const activeJobs = jobCount("active") + jobCount("published");
  const draftJobs = jobCount("draft");
  const closedJobs = jobCount("closed");
  const totalJobs = activeJobs + draftJobs + closedJobs;

  const activeProjects = projectCount("Active") + projectCount("Published");
  const draftProjects = projectCount("Draft");
  const closedProjects = projectCount("Closed") + projectCount("Archived");
  const totalProjects = activeProjects + draftProjects + closedProjects;

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Overview fetched", {
      overview: {
        totalJobs,
        activeJobs,
        draftJobs,
        closedJobs,
        inactiveJobs,
        totalApplications,
        totalCandidates,
        totalProjects,
        activeProjects,
        draftProjects,
        closedProjects,
        totalRevenue: paymentStats[0]?.totalRevenue || 0,
        totalPaidApplications: paymentStats[0]?.totalPaidApplications || 0,
      },
      applicationsByStatus,
    }),
  );
});

/**
 * @swagger
 * /api/admin/analytics/funnel:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get application conversion funnel
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Funnel data with conversion rates
 */
const getFunnel = asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  const matchFilter = buildDateFilter({ startDate, endDate });
  if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
    matchFilter.jobId = new mongoose.Types.ObjectId(jobId);
  }

  const funnel = await fetchWithCache('funnel', async () => {
    return Application.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          started: { $sum: 1 },
          personalDetailsCompleted: {
            $sum: { $cond: [{ $gte: ["$currentStep", 2] }, 1, 0] },
          },
          educationCompleted: {
            $sum: { $cond: [{ $gte: ["$currentStep", 3] }, 1, 0] },
          },
          documentsUploaded: {
            $sum: { $cond: [{ $gte: ["$currentStep", 6] }, 1, 0] },
          },
          paymentCompleted: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
          },
          submitted: {
            $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] },
          },
        },
      },
    ]);
  }, req.query);

  const f = funnel[0] || {
    started: 0,
    personalDetailsCompleted: 0,
    educationCompleted: 0,
    documentsUploaded: 0,
    paymentCompleted: 0,
    submitted: 0,
  };

  const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
  const conversionRates = {
    personalDetails: pct(f.personalDetailsCompleted, f.started),
    education: pct(f.educationCompleted, f.personalDetailsCompleted),
    documents: pct(f.documentsUploaded, f.educationCompleted),
    payment: pct(f.paymentCompleted, f.documentsUploaded),
    submission: pct(f.submitted, f.paymentCompleted),
    overall: pct(f.submitted, f.started),
  };

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Funnel fetched", {
        funnel: f,
        conversionRates,
      }),
    );
});

/**
 * @swagger
 * /api/admin/analytics/top-jobs:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get top performing jobs by applicants
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Top jobs list
 */
const getTopJobs = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const dateFilter = buildDateFilter(req.query);

  const topJobs = await fetchWithCache('topJobs', async () => {
    return Application.aggregate([
      { $match: { ...dateFilter, status: { $ne: "draft" } } },
      {
        $group: {
          _id: "$jobId",
          totalApplications: { $sum: 1 },
          paidApplications: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
          },
          submittedApplications: {
            $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] },
          },
        },
      },
      { $sort: { totalApplications: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $project: {
          jobTitle: "$job.title",
          department: "$job.department",
          postCode: "$job.postCode",
          totalApplications: 1,
          paidApplications: 1,
          submittedApplications: 1,
          conversionRate: {
            $cond: [
              { $gt: ["$totalApplications", 0] },
              {
                $multiply: [
                  { $divide: ["$submittedApplications", "$totalApplications"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    ]);
  }, req.query);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Top jobs fetched", { topJobs }));
});

/**
 * @swagger
 * /api/admin/analytics/payments:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get payment analytics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment analytics data
 */
const getPaymentAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = buildDateFilter({ startDate, endDate });

  const [paymentByStatus, dailyPayments, paymentByMethod] = await Promise.all([
    Application.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalFee" },
        },
      },
    ]),
    Application.aggregate([
      { $match: { ...dateFilter, paymentStatus: "paid" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          amount: { $sum: "$totalFee" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Application.aggregate([
      { $match: { ...dateFilter, paymentStatus: "paid" } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalFee" },
        },
      },
    ]),
  ]);

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Payment analytics fetched", {
        paymentByStatus,
        dailyPayments,
        paymentByMethod,
      }),
    );
});

/**
 * @swagger
 * /api/admin/analytics/departments:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get department-wise statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Department stats
 */
const getDepartmentStats = asyncHandler(async (req, res) => {
  const departmentStats = await Job.aggregate([
    { $match: { status: "active" } },
    {
      $lookup: {
        from: "applications",
        localField: "_id",
        foreignField: "jobId",
        as: "applications",
      },
    },
    {
      $group: {
        _id: "$department",
        totalJobs: { $sum: 1 },
        totalVacancies: { $sum: "$totalPosts" },
        totalApplications: { $sum: { $size: "$applications" } },
      },
    },
    { $sort: { totalApplications: -1 } },
  ]);

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Department stats fetched", {
        departmentStats,
      }),
    );
});

/**
 * @swagger
 * /api/admin/analytics/demographics:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get candidate demographics (category & gender)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Demographics data
 */
const getDemographics = asyncHandler(async (req, res) => {
  const [categoryStats, genderStats] = await Promise.all([
    Application.aggregate([
      { $match: { status: { $ne: "draft" } } },
      {
        $lookup: {
          from: "users",
          localField: "candidateId",
          foreignField: "_id",
          as: "candidate",
        },
      },
      { $unwind: "$candidate" },
      { $group: { _id: "$candidate.category", count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: { status: { $ne: "draft" } } },
      {
        $lookup: {
          from: "users",
          localField: "candidateId",
          foreignField: "_id",
          as: "candidate",
        },
      },
      { $unwind: "$candidate" },
      { $group: { _id: "$candidate.gender", count: { $sum: 1 } } },
    ]),
  ]);

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Demographics fetched", {
        categoryStats,
        genderStats,
      }),
    );
});

module.exports = {
  getOverview,
  getFunnel,
  getTopJobs,
  getPaymentAnalytics,
  getDepartmentStats,
  getDemographics,
};


