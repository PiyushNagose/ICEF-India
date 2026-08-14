const { StatusCodes } = require("http-status-codes");
const examService = require("../../shared/services/exam.service");
const bulkExamJobService = require("../../shared/services/bulkExamJob.service");
const { htmlToPdfBuffer } = require("../../shared/services/pdf.service");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");

const emitExamRealtime = (event, payload = {}, options = {}) => {
  try {
    emitToAdmins(event, { ...payload, timestamp: new Date() });
    if (options.public) {
      emitBroadcast(event, { ...payload, timestamp: new Date() });
    }
  } catch {
    // Socket.IO may not be initialized in test/CLI contexts.
  }
};

const listCenters = asyncHandler(async (req, res) => {
  const result = await examService.listCenters(req.query);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam centers fetched", result.centers, result.meta));
});

const createCenter = asyncHandler(async (req, res) => {
  const center = await examService.createCenter(req.body, req.user.id);
  await saveAuditLog(req, `Created exam center: ${center.centerCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_CENTER_CHANGED, {
    action: "created",
    centerId: center._id,
    centerCode: center.centerCode,
  });
  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, "Exam center created", { center }));
});

const getCenter = asyncHandler(async (req, res) => {
  const result = await examService.getCenter(req.params.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam center fetched", result));
});

const updateCenter = asyncHandler(async (req, res) => {
  const center = await examService.updateCenter(req.params.id, req.body, req.user.id);
  await saveAuditLog(req, `Updated exam center: ${center.centerCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_CENTER_CHANGED, {
    action: "updated",
    centerId: center._id,
    centerCode: center.centerCode,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam center updated", { center }));
});

const listRooms = asyncHandler(async (req, res) => {
  const result = await examService.listRooms(req.params.centerId);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam rooms fetched", result));
});

const createRoom = asyncHandler(async (req, res) => {
  const room = await examService.createRoom(req.params.centerId, req.body, req.user.id);
  await saveAuditLog(req, `Created exam room: ${room.roomCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ROOM_CHANGED, {
    action: "created",
    centerId: req.params.centerId,
    roomId: room._id,
    roomCode: room.roomCode,
  });
  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, "Exam room created", { room }));
});

const updateRoom = asyncHandler(async (req, res) => {
  const room = await examService.updateRoom(req.params.roomId, req.body, req.user.id);
  await saveAuditLog(req, `Updated exam room: ${room.roomCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ROOM_CHANGED, {
    action: "updated",
    centerId: room.centerId,
    roomId: room._id,
    roomCode: room.roomCode,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam room updated", { room }));
});

const listSchedules = asyncHandler(async (req, res) => {
  const result = await examService.listSchedules(req.query);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam schedules fetched", result.schedules, result.meta));
});

const createSchedule = asyncHandler(async (req, res) => {
  const schedule = await examService.createSchedule(req.body, req.user.id);
  await saveAuditLog(req, `Created exam schedule: ${schedule.examCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_SCHEDULE_CREATED, {
    scheduleId: schedule._id,
    jobId: schedule.jobId?._id || schedule.jobId,
    status: schedule.status,
  });
  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, "Exam schedule created", { schedule }));
});

const getSchedule = asyncHandler(async (req, res) => {
  const schedule = await examService.getSchedule(req.params.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam schedule fetched", { schedule }));
});

const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await examService.updateSchedule(req.params.id, req.body, req.user.id);
  await saveAuditLog(req, `Updated exam schedule: ${schedule.examCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_SCHEDULE_UPDATED, {
    scheduleId: schedule._id,
    jobId: schedule.jobId?._id || schedule.jobId,
    status: schedule.status,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam schedule updated", { schedule }));
});

const getScheduleStats = asyncHandler(async (req, res) => {
  const result = await examService.getScheduleStats(req.params.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam schedule stats fetched", result));
});

const previewAllocation = asyncHandler(async (req, res) => {
  const result = await examService.previewAllocation(req.params.id, req.body);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Allocation preview generated", result));
});

const allocateCandidates = asyncHandler(async (req, res) => {
  const result = await examService.allocateCandidates(req.params.id, req.body, req.user.id);
  await saveAuditLog(req, `Allocated candidates for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ALLOCATION_CHANGED, {
    action: "allocated",
    scheduleId: req.params.id,
    summary: result.summary,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Candidates allocated", result));
});

const lockAllocation = asyncHandler(async (req, res) => {
  const schedule = await examService.lockAllocation(req.params.id, req.user.id);
  await saveAuditLog(req, `Locked allocation for exam schedule: ${schedule.examCode}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ALLOCATION_CHANGED, {
    action: "locked",
    scheduleId: schedule._id,
    jobId: schedule.jobId?._id || schedule.jobId,
    status: schedule.status,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Allocation locked", { schedule }));
});

const listAllocations = asyncHandler(async (req, res) => {
  const result = await examService.listAllocations(req.params.id, req.query);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Allocations fetched", result.allocations, result.meta));
});

const generateAdmitCards = asyncHandler(async (req, res) => {
  const result = await examService.generateAdmitCards(req.params.id, req.user.id);
  await saveAuditLog(req, `Generated admit cards for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ADMIT_CARD_GENERATED, {
    scheduleId: req.params.id,
    generatedCount: result.summary?.created ?? result.generatedCount ?? 0,
    updatedCount: result.summary?.updated ?? result.updatedCount ?? 0,
    summary: result.summary,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit cards generated", result));
});

const publishAdmitCards = asyncHandler(async (req, res) => {
  const result = await examService.publishAdmitCards(req.params.id, req.user.id);
  if (!result.alreadyPublished) {
    await saveAuditLog(req, `Published admit cards for exam schedule: ${req.params.id}`);
    emitExamRealtime(
      SOCKET_EVENTS.EXAM_ADMIT_CARD_PUBLISHED,
      {
        scheduleId: req.params.id,
        jobId: result.schedule?.jobId?._id || result.schedule?.jobId,
        publishedCount: result.publishedCount,
        status: result.schedule?.status,
      },
      { public: true },
    );
  }
  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(
        StatusCodes.OK,
        result.alreadyPublished
          ? "Admit-card window already published"
          : "Admit-card window published",
        result,
      ),
    );
});

const getOpsSummary = asyncHandler(async (req, res) => {
  const result = await examService.getExamOpsSummary();
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Exam operations summary fetched", result));
});

const unpublishAdmitCards = asyncHandler(async (req, res) => {
  const result = await examService.unpublishAdmitCards(
    req.params.id,
    req.user.id,
    req.body?.reason,
  );
  await saveAuditLog(req, `Unpublished admit cards for exam schedule: ${req.params.id}`);
  emitExamRealtime(
    SOCKET_EVENTS.EXAM_ADMIT_CARD_UNPUBLISHED,
    {
      scheduleId: req.params.id,
      jobId: result.schedule?.jobId?._id || result.schedule?.jobId,
      unpublishedCount: result.unpublishedCount,
      status: result.schedule?.status,
    },
    { public: true },
  );
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit cards unpublished", result));
});

const regenerateAdmitCards = asyncHandler(async (req, res) => {
  const result = await examService.regenerateAdmitCards(req.params.id, req.user.id, req.body || {});
  await saveAuditLog(req, `Regenerated admit cards for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_ADMIT_CARD_GENERATED, {
    action: "regenerated",
    scheduleId: req.params.id,
    generatedCount: result.generatedCount ?? 0,
    updatedCount: result.updatedCount ?? 0,
  });
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit cards regenerated", result));
});

const listAdmitCards = asyncHandler(async (req, res) => {
  const result = await examService.listAdmitCards(req.params.id, req.query);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Admit cards fetched", result.admitCards, result.meta));
});

const renderAdmitCardHtml = asyncHandler(async (req, res) => {
  const html = await examService.renderAdmitCardHtml(req.params.admitCardId, {
    embed: req.query.embed === "1" || req.query.embed === "true",
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(StatusCodes.OK).send(html);
});

const downloadAdmitCardPdf = asyncHandler(async (req, res) => {
  const html = await examService.renderAdmitCardHtml(req.params.admitCardId);
  const pdf = await htmlToPdfBuffer(html);
  const fileName = `admit-card-${req.params.admitCardId}.pdf`;
  await saveAuditLog(req, `Downloaded admit card PDF: ${req.params.admitCardId}`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", pdf.length);
  res.status(StatusCodes.OK).send(pdf);
});

const renderAttendanceSheetHtml = asyncHandler(async (req, res) => {
  const html = await examService.renderAttendanceSheetHtml(req.params.id, req.query);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(StatusCodes.OK).send(html);
});

const downloadAttendanceSheetPdf = asyncHandler(async (req, res) => {
  const html = await examService.renderAttendanceSheetHtml(req.params.id, req.query);
  const pdf = await htmlToPdfBuffer(html);
  const centerSuffix = req.query.centerId ? `-${req.query.centerId}` : "";
  const fileName = `attendance-sheet-${req.params.id}${centerSuffix}.pdf`;
  await saveAuditLog(req, `Downloaded attendance sheet PDF: ${req.params.id}${centerSuffix}`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", pdf.length);
  res.status(StatusCodes.OK).send(pdf);
});

const enqueueAllocation = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.enqueueJob({
    type: "allocation",
    examScheduleId: req.params.id,
    requestedBy: req.user.id,
    options: req.body || {},
  });
  await saveAuditLog(req, `Queued background allocation for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_BULK_JOB_UPDATED, {
    action: "queued",
    scheduleId: req.params.id,
    jobId: job._id,
    type: job.type,
    status: job.status,
  });
  res
    .status(StatusCodes.ACCEPTED)
    .json(new ApiResponse(StatusCodes.ACCEPTED, "Allocation job queued", { job }));
});

const enqueueAdmitCardGeneration = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.enqueueJob({
    type: "admit_card_generation",
    examScheduleId: req.params.id,
    requestedBy: req.user.id,
    options: req.body || {},
  });
  await saveAuditLog(req, `Queued background admit card generation for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_BULK_JOB_UPDATED, {
    action: "queued",
    scheduleId: req.params.id,
    jobId: job._id,
    type: job.type,
    status: job.status,
  });
  res
    .status(StatusCodes.ACCEPTED)
    .json(new ApiResponse(StatusCodes.ACCEPTED, "Admit card generation job queued", { job }));
});

const enqueueAdmitCardZip = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.enqueueJob({
    type: "admit_card_zip",
    examScheduleId: req.params.id,
    requestedBy: req.user.id,
    options: req.body || {},
  });
  await saveAuditLog(req, `Queued bulk admit card ZIP for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_BULK_JOB_UPDATED, {
    action: "queued",
    scheduleId: req.params.id,
    jobId: job._id,
    type: job.type,
    status: job.status,
  });
  res
    .status(StatusCodes.ACCEPTED)
    .json(new ApiResponse(StatusCodes.ACCEPTED, "Bulk admit card ZIP job queued", { job }));
});

const enqueueAttendanceZip = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.enqueueJob({
    type: "attendance_zip",
    examScheduleId: req.params.id,
    requestedBy: req.user.id,
    options: req.body || {},
  });
  await saveAuditLog(req, `Queued attendance ZIP for exam schedule: ${req.params.id}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_BULK_JOB_UPDATED, {
    action: "queued",
    scheduleId: req.params.id,
    jobId: job._id,
    type: job.type,
    status: job.status,
  });
  res
    .status(StatusCodes.ACCEPTED)
    .json(new ApiResponse(StatusCodes.ACCEPTED, "Attendance ZIP job queued", { job }));
});

const getBulkJob = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.getJob(req.params.jobId, req.user.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Bulk job fetched", { job }));
});

const retryBulkJob = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.retryJob(req.params.jobId, req.user.id);
  await saveAuditLog(req, `Retried bulk exam job: ${req.params.jobId}`);
  emitExamRealtime(SOCKET_EVENTS.EXAM_BULK_JOB_UPDATED, {
    action: "retried",
    scheduleId: job.examScheduleId,
    jobId: job._id,
    type: job.type,
    status: job.status,
  });
  res
    .status(StatusCodes.ACCEPTED)
    .json(new ApiResponse(StatusCodes.ACCEPTED, "Bulk job retry queued", { job }));
});

const downloadBulkJob = asyncHandler(async (req, res) => {
  const job = await bulkExamJobService.getDownload(req.params.jobId, req.user.id);
  await saveAuditLog(req, `Downloaded bulk exam file: ${job.result.fileName}`);
  res.download(job.result.filePath, job.result.fileName);
});

module.exports = {
  listCenters,
  createCenter,
  getCenter,
  updateCenter,
  listRooms,
  createRoom,
  updateRoom,
  listSchedules,
  createSchedule,
  getSchedule,
  updateSchedule,
  getScheduleStats,
  getOpsSummary,
  previewAllocation,
  allocateCandidates,
  lockAllocation,
  listAllocations,
  generateAdmitCards,
  publishAdmitCards,
  unpublishAdmitCards,
  regenerateAdmitCards,
  listAdmitCards,
  renderAdmitCardHtml,
  downloadAdmitCardPdf,
  renderAttendanceSheetHtml,
  downloadAttendanceSheetPdf,
  enqueueAllocation,
  enqueueAdmitCardGeneration,
  enqueueAdmitCardZip,
  enqueueAttendanceZip,
  getBulkJob,
  retryBulkJob,
  downloadBulkJob,
};
