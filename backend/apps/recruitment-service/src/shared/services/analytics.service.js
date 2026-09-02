const Application = require("../models/Application");
const Job = require("../models/Job");
const Project = require("../models/Project");
const Payment = require("../models/Payment");
const SupportTicket = require("../models/SupportTicket");
const User = require("../models/User");
const { startOfToday } = require("../utils/timeline");

const getDashboardStats = async () => {
  const [
    totalApplications,
    completedApplications,
    pendingReview,
    totalJobs,
    activeJobs,
    totalProjects,
    activeProjects,
    totalCandidates,
    paymentStats,
    supportStats,
  ] = await Promise.all([
    Application.countDocuments({ status: { $ne: "draft" } }),
    Application.countDocuments({
      status: { $in: ["approved", "shortlisted"] },
    }),
    Application.countDocuments({ status: "under_review" }),
    Job.countDocuments(),
    Job.countDocuments({
      status: "active",
      $or: [
        { applicationDeadline: { $exists: false } },
        { applicationDeadline: null },
        { applicationDeadline: { $gte: startOfToday() } },
      ],
    }),
    Project.countDocuments(),
    Project.countDocuments({ status: "Active" }),
    User.countDocuments({ role: "candidate" }),
    Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]),
    SupportTicket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const paymentMap = {};
  paymentStats.forEach((p) => {
    paymentMap[p._id] = { count: p.count, total: p.total };
  });

  const supportMap = {};
  supportStats.forEach((s) => {
    supportMap[s._id] = s.count;
  });

  const totalRevenue = paymentMap["success"]?.total || 0;
  const paymentSuccessCount = paymentMap["success"]?.count || 0;
  const paymentFailedCount = paymentMap["failed"]?.count || 0;
  const paymentSuccessRate =
    paymentSuccessCount + paymentFailedCount > 0
      ? (
          (paymentSuccessCount / (paymentSuccessCount + paymentFailedCount)) *
          100
        ).toFixed(1)
      : 0;

  return {
    applications: {
      total: totalApplications,
      completed: completedApplications,
      pendingReview,
      completionRate:
        totalApplications > 0
          ? ((completedApplications / totalApplications) * 100).toFixed(1)
          : 0,
    },
    jobs: { total: totalJobs, active: activeJobs },
    projects: { total: totalProjects, active: activeProjects },
    candidates: { total: totalCandidates },
    payments: {
      successRate: paymentSuccessRate,
      totalRevenue,
      successCount: paymentSuccessCount,
      failedCount: paymentFailedCount,
    },
    support: {
      open: supportMap["Open"] || 0,
      inProgress: supportMap["In Progress"] || 0,
      resolved: supportMap["Resolved"] || 0,
    },
  };
};

const getApplicationFunnel = async (jobId) => {
  const mongoose = require("mongoose");
  const match = jobId ? { jobId: new mongoose.Types.ObjectId(jobId) } : {};

  const funnel = await Application.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        started: { $sum: 1 },
        filled: { $sum: { $cond: [{ $gte: ["$currentStep", 4] }, 1, 0] } },
        uploaded: { $sum: { $cond: [{ $gte: ["$currentStep", 6] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
        submitted: { $sum: { $cond: [{ $ne: ["$status", "draft"] }, 1, 0] } },
      },
    },
  ]);

  return (
    funnel[0] || { started: 0, filled: 0, uploaded: 0, paid: 0, submitted: 0 }
  );
};

const getTopJobs = async (limit = 5) => {
  return Job.find({ status: "active" })
    .select("title department totalApplicants applicationDeadline")
    .sort({ totalApplicants: -1 })
    .limit(limit);
};

const getPaymentAnalytics = async () => {
  const stats = await Payment.aggregate([
    {
      $group: {
        _id: { status: "$status", gateway: "$gateway" },
        count: { $sum: 1 },
        total: { $sum: "$amount" },
      },
    },
  ]);
  return stats;
};

module.exports = {
  getDashboardStats,
  getApplicationFunnel,
  getTopJobs,
  getPaymentAnalytics,
};

