const fs = require("fs");
const os = require("os");
const path = require("path");
const { StatusCodes } = require("http-status-codes");
const BulkExamJob = require("../models/BulkExamJob");
const AdmitCard = require("../models/AdmitCard");
const ExamCenter = require("../models/ExamCenter");
const CandidateAllocation = require("../models/CandidateAllocation");
const ActivityLog = require("../models/ActivityLog");
const examService = require("./exam.service");
const { htmlToPdfBuffer } = require("./pdf.service");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { createZipBuffer } = require("../utils/zip");
const { publishToQueue, QUEUES } = require("../config/rabbitmq");

const outputDir = path.join(os.tmpdir(), "recruitment-portal-exam-jobs");

const ensureOutputDir = async () => {
  await fs.promises.mkdir(outputDir, { recursive: true });
};

const sanitizeFileName = (value) =>
  String(value || "document")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "document";

const writeAudit = async ({ userId, action, details, resourceId }) => {
  try {
    await ActivityLog.create({
      employeeId: userId,
      module: "AdmitCards",
      action,
      details,
      resourceId: resourceId?.toString(),
    });
  } catch (error) {
    logger.error(`Bulk exam job audit failed: ${error.message}`);
  }
};

const markProgress = (job, patch) => {
  job.progress = {
    ...(job.progress?.toObject?.() || job.progress || {}),
    ...patch,
  };
};

const getJob = async (id, userId) => {
  const job = await BulkExamJob.findById(id).populate("examScheduleId", "examName examCode examDate status");
  if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Bulk job not found");
  if (userId && job.requestedBy?.toString() !== userId.toString()) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You cannot access this bulk job");
  }
  return job;
};

const updateJobStart = async (job) => {
  job.status = "running";
  job.startedAt = new Date();
  job.failedAt = undefined;
  job.attempts += 1;
  markProgress(job, { processed: 0, failed: 0, message: "Started" });
  await job.save();
};

const completeJob = async (job, summary = {}) => {
  job.status = "completed";
  job.completedAt = new Date();
  job.failedAt = undefined;
  job.result = {
    ...(job.result?.toObject?.() || job.result || {}),
    summary,
  };
  markProgress(job, { processed: job.progress.total || job.progress.processed, message: "Completed" });
  await job.save();
};

const failJob = async (job, error) => {
  job.status = "failed";
  job.failedAt = new Date();
  job.errors.push({
    message: error.message,
    stack: error.stack,
  });
  markProgress(job, { message: error.message });
  await job.save();
};

const processAllocationJob = async (job) => {
  markProgress(job, { total: 1, processed: 0, message: "Allocating candidates" });
  await job.save();
  const result = await examService.allocateCandidates(job.examScheduleId, job.options || {}, job.requestedBy);
  await writeAudit({
    userId: job.requestedBy,
    action: "ALLOCATE",
    details: `Background allocation completed for exam schedule: ${job.examScheduleId}`,
    resourceId: job.examScheduleId,
  });
  await completeJob(job, result.summary || {});
};

const processGenerateJob = async (job) => {
  markProgress(job, { total: 1, processed: 0, message: "Generating admit cards" });
  await job.save();
  const result = await examService.generateAdmitCards(job.examScheduleId, job.requestedBy);
  await writeAudit({
    userId: job.requestedBy,
    action: "GENERATE",
    details: `Background admit card generation completed for exam schedule: ${job.examScheduleId}`,
    resourceId: job.examScheduleId,
  });
  await completeJob(job, result.summary || {});
};

const processAdmitCardZipJob = async (job) => {
  const filter = { examScheduleId: job.examScheduleId };
  if (job.options?.status) filter.status = job.options.status;
  if (job.options?.centerId) {
    const allocationIds = await CandidateAllocation.find({
      examScheduleId: job.examScheduleId,
      centerId: job.options.centerId,
    }).distinct("_id");
    filter.allocationId = { $in: allocationIds };
  }

  const cards = await AdmitCard.find(filter).select("_id rollNumber admitCardNumber").sort({ rollNumber: 1 });
  if (cards.length === 0) throw new ApiError(StatusCodes.NOT_FOUND, "No admit cards found for bulk ZIP");

  markProgress(job, { total: cards.length, processed: 0, message: "Rendering admit cards" });
  await job.save();

  const files = [{
    name: "README.txt",
    content:
      "This archive contains generated admit card PDF files.\n",
  }];

  for (const card of cards) {
    const html = await examService.renderAdmitCardHtml(card._id, { trackDownload: false });
    const pdf = await htmlToPdfBuffer(html);
    files.push({
      name: `admit-cards/${sanitizeFileName(card.rollNumber)}-${sanitizeFileName(card.admitCardNumber)}.pdf`,
      content: pdf,
    });
    markProgress(job, { processed: files.length - 1, message: `Rendered ${files.length - 1}/${cards.length}` });
    if ((files.length - 1) % 25 === 0) await job.save();
  }

  await ensureOutputDir();
  const fileName = `admit-cards-${job.examScheduleId}-${Date.now()}.zip`;
  const filePath = path.join(outputDir, fileName);
  const zipBuffer = createZipBuffer(files);
  await fs.promises.writeFile(filePath, zipBuffer);

  job.result = {
    filePath,
    fileName,
    mimeType: "application/zip",
    size: zipBuffer.length,
    summary: { files: files.length - 1 },
  };
  await writeAudit({
    userId: job.requestedBy,
    action: "BULK_DOWNLOAD",
    details: `Generated bulk admit card ZIP with ${files.length - 1} files`,
    resourceId: job.examScheduleId,
  });
  await completeJob(job, job.result.summary);
};

const processAttendanceZipJob = async (job) => {
  const centerFilter = { active: { $ne: false } };
  if (job.options?.centerId) {
    centerFilter._id = job.options.centerId;
  } else {
    const centerIds = await CandidateAllocation.find({
      examScheduleId: job.examScheduleId,
      status: "allocated",
    }).distinct("centerId");
    centerFilter._id = { $in: centerIds };
  }

  const centers = await ExamCenter.find(centerFilter).sort({ centerCode: 1 });
  if (centers.length === 0) throw new ApiError(StatusCodes.NOT_FOUND, "No centers found for attendance ZIP");

  markProgress(job, { total: centers.length, processed: 0, message: "Rendering attendance sheets" });
  await job.save();

  const files = [{
    name: "README.txt",
    content:
      "This archive contains generated center-wise attendance sheet PDF files.\n",
  }];

  for (const center of centers) {
    try {
      const html = await examService.renderAttendanceSheetHtml(job.examScheduleId, { centerId: center._id });
      const pdf = await htmlToPdfBuffer(html);
      files.push({
        name: `attendance/${sanitizeFileName(center.centerCode)}-${sanitizeFileName(center.name)}.pdf`,
        content: pdf,
      });
    } catch (error) {
      job.progress.failed += 1;
      job.errors.push({ message: `${center.centerCode}: ${error.message}` });
    }
    markProgress(job, { processed: job.progress.processed + 1, message: `Rendered ${job.progress.processed + 1}/${centers.length}` });
    if (job.progress.processed % 25 === 0) await job.save();
  }

  if (files.length === 1) throw new ApiError(StatusCodes.NOT_FOUND, "No attendance sheets could be generated");

  await ensureOutputDir();
  const fileName = `attendance-sheets-${job.examScheduleId}-${Date.now()}.zip`;
  const filePath = path.join(outputDir, fileName);
  const zipBuffer = createZipBuffer(files);
  await fs.promises.writeFile(filePath, zipBuffer);

  job.result = {
    filePath,
    fileName,
    mimeType: "application/zip",
    size: zipBuffer.length,
    summary: { files: files.length - 1, failedCenters: job.progress.failed },
  };
  await writeAudit({
    userId: job.requestedBy,
    action: "BULK_DOWNLOAD",
    details: `Generated attendance ZIP with ${files.length - 1} center files`,
    resourceId: job.examScheduleId,
  });
  await completeJob(job, job.result.summary);
};

const processJob = async (jobId) => {
  const job = await BulkExamJob.findById(jobId);
  if (!job || job.status === "running" || job.status === "completed") return;

  try {
    await updateJobStart(job);
    if (job.type === "allocation") await processAllocationJob(job);
    if (job.type === "admit_card_generation") await processGenerateJob(job);
    if (job.type === "admit_card_zip") await processAdmitCardZipJob(job);
    if (job.type === "attendance_zip") await processAttendanceZipJob(job);
  } catch (error) {
    await failJob(job, error);
    logger.error(`Bulk exam job ${job._id} failed: ${error.message}`);
  }
};

const enqueueJob = async ({ type, examScheduleId, requestedBy, options = {} }) => {
  const job = await BulkExamJob.create({
    type,
    examScheduleId,
    requestedBy,
    options,
    progress: { total: 0, processed: 0, failed: 0, message: "Queued" },
  });

  await publishToQueue(QUEUES.PDF_GENERATION, {
    jobId: job._id.toString(),
    type,
    examScheduleId: examScheduleId.toString(),
  });

  setImmediate(() => processJob(job._id).catch((error) => {
    logger.error(`Bulk exam job runner failed: ${error.message}`);
  }));

  return job;
};

const retryJob = async (id, userId) => {
  const job = await getJob(id, userId);
  if (job.status !== "failed") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Only failed jobs can be retried");
  }
  if (job.attempts >= job.maxAttempts) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Maximum retry attempts reached");
  }
  job.status = "queued";
  job.completedAt = undefined;
  job.failedAt = undefined;
  markProgress(job, { processed: 0, failed: 0, message: "Retry queued" });
  await job.save();
  await writeAudit({
    userId,
    action: "RETRY",
    details: `Retried bulk exam job: ${job._id}`,
    resourceId: job.examScheduleId,
  });
  setImmediate(() => processJob(job._id).catch((error) => {
    logger.error(`Bulk exam job retry failed: ${error.message}`);
  }));
  return job;
};

const getDownload = async (id, userId) => {
  const job = await getJob(id, userId);
  if (job.status !== "completed" || !job.result?.filePath) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Bulk file is not ready yet");
  }
  try {
    await fs.promises.access(job.result.filePath, fs.constants.R_OK);
  } catch {
    throw new ApiError(StatusCodes.GONE, "Bulk file expired or missing. Please generate it again.");
  }
  return job;
};

module.exports = {
  enqueueJob,
  getJob,
  retryJob,
  getDownload,
};
