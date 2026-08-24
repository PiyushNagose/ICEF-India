const Job = require("../models/Job");
const Project = require("../models/Project");
const ApiError = require("../utils/ApiError");
const { getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../socket/index");
const { assertJobTimeline, endOfDay } = require("../utils/timeline");

const createJob = async (data, createdBy) => {
  const project = await Project.findById(data.projectId);
  if (!project) throw new ApiError(404, "Project not found");
  assertJobTimeline(data, project);

  const job = await Job.create({ ...data, createdBy, status: "draft" });

  // Update project job count
  await Project.findByIdAndUpdate(data.projectId, { $inc: { totalJobs: 1 } });

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_created",
    jobId: job._id,
  });
  return job;
};

const getAdminJobs = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.projectId) filter.projectId = query.projectId;
  if (query.department) filter.department = new RegExp(query.department, "i");

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .populate("projectId", "name department state")
      .populate("createdBy", "fullName employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return { jobs, meta: paginationMeta(total, page, limit) };
};

const getPublicJobs = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = { status: "active" };
  if (query.department) filter.department = new RegExp(query.department, "i");
  if (query.category) filter.category = query.category;
  if (query.search) {
    filter.$or = [
      { title: new RegExp(query.search, "i") },
      { department: new RegExp(query.search, "i") },
    ];
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select(
        "title postCode department category totalPosts applicationFee applicationDeadline status totalApplicants workLocation",
      )
      .populate("projectId", "name state")
      .sort({ applicationDeadline: 1 })
      .skip(skip)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return { jobs, meta: paginationMeta(total, page, limit) };
};

const getJobById = async (id, isAdmin = false) => {
  const query = Job.findById(id).populate("projectId", "name department state");
  if (isAdmin) query.populate("createdBy", "fullName employeeId");

  const job = await query;
  if (!job) throw new ApiError(404, "Job not found");
  if (!isAdmin && job.status !== "active")
    throw new ApiError(404, "Job not found");
  return job;
};

const updateJob = async (id, data) => {
  const existing = await Job.findById(id);
  if (!existing) throw new ApiError(404, "Job not found");
  const project = await Project.findById(data.projectId || existing.projectId);
  if (!project) throw new ApiError(404, "Project not found");
  const nextJob = { ...existing.toObject(), ...data };
  if (data.paymentConfig) {
    nextJob.paymentConfig = {
      ...(existing.toObject().paymentConfig || {}),
      ...data.paymentConfig,
    };
  }
  assertJobTimeline(nextJob, project);
  const job = await Job.findByIdAndUpdate(
    id,
    { ...data },
    { new: true, runValidators: true },
  );
  if (!job) throw new ApiError(404, "Job not found");
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "job_updated",
    jobId: id,
  });
  return job;
};

const publishJob = async (id) => {
  const job = await Job.findById(id).populate("projectId");
  if (!job) throw new ApiError(404, "Job not found");
  if (job.status === "active")
    throw new ApiError(400, "Job is already published");
  if (!job.applicationDeadline)
    throw new ApiError(400, "Application deadline is required before publishing");
  assertJobTimeline(job.toObject(), job.projectId);

  const deadline = endOfDay(job.applicationDeadline);
  if (deadline && new Date() > deadline) {
    throw new ApiError(
      400,
      "Cannot publish job. Application deadline has already passed. Update the deadline before publishing.",
    );
  }

  job.status = "active";
  job.publishedAt = new Date();
  await job.save();

  // Notify all connected users about new job
  emitBroadcast(SOCKET_EVENTS.JOB_PUBLISHED, {
    jobId: job._id,
    title: job.title,
    department: job.department,
  });

  return job;
};

const deleteJob = async (id) => {
  const job = await Job.findByIdAndDelete(id);
  if (!job) throw new ApiError(404, "Job not found");
  await Project.findByIdAndUpdate(job.projectId, { $inc: { totalJobs: -1 } });
  return { message: "Job deleted successfully" };
};

module.exports = {
  createJob,
  getAdminJobs,
  getPublicJobs,
  getJobById,
  updateJob,
  publishJob,
  deleteJob,
};

