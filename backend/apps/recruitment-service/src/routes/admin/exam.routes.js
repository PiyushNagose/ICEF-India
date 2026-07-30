const express = require("express");
const router = express.Router();
const examController = require("../../controllers/admin/exam.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const validate = require("../../shared/middlewares/validate");
const {
  createCenterSchema,
  updateCenterSchema,
  createRoomSchema,
  updateRoomSchema,
  createScheduleSchema,
  updateScheduleSchema,
  allocationOptionsSchema,
} = require("../../shared/validations/exam.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get(
  "/centers",
  checkPermission("admitCards", "view"),
  examController.listCenters,
);
router.post(
  "/centers",
  checkPermission("admitCards", "create"),
  validate(createCenterSchema),
  auditLog("AdmitCards", "CREATE"),
  examController.createCenter,
);
router.get(
  "/centers/:id",
  checkPermission("admitCards", "view"),
  examController.getCenter,
);
router.put(
  "/centers/:id",
  checkPermission("admitCards", "edit"),
  validate(updateCenterSchema),
  auditLog("AdmitCards", "UPDATE"),
  examController.updateCenter,
);

router.get(
  "/centers/:centerId/rooms",
  checkPermission("admitCards", "view"),
  examController.listRooms,
);
router.post(
  "/centers/:centerId/rooms",
  checkPermission("admitCards", "create"),
  validate(createRoomSchema),
  auditLog("AdmitCards", "CREATE"),
  examController.createRoom,
);
router.put(
  "/rooms/:roomId",
  checkPermission("admitCards", "edit"),
  validate(updateRoomSchema),
  auditLog("AdmitCards", "UPDATE"),
  examController.updateRoom,
);

router.get(
  "/schedules",
  checkPermission("admitCards", "view"),
  examController.listSchedules,
);
router.post(
  "/schedules",
  checkPermission("admitCards", "create"),
  validate(createScheduleSchema),
  auditLog("AdmitCards", "CREATE"),
  examController.createSchedule,
);
router.get(
  "/schedules/:id",
  checkPermission("admitCards", "view"),
  examController.getSchedule,
);
router.put(
  "/schedules/:id",
  checkPermission("admitCards", "edit"),
  validate(updateScheduleSchema),
  auditLog("AdmitCards", "UPDATE"),
  examController.updateSchedule,
);
router.get(
  "/schedules/:id/stats",
  checkPermission("admitCards", "view"),
  examController.getScheduleStats,
);
router.post(
  "/schedules/:id/allocation/preview",
  checkPermission("admitCards", "view"),
  validate(allocationOptionsSchema),
  examController.previewAllocation,
);
router.post(
  "/schedules/:id/allocation/run",
  checkPermission("admitCards", "edit"),
  validate(allocationOptionsSchema),
  auditLog("AdmitCards", "ALLOCATE"),
  examController.allocateCandidates,
);
router.post(
  "/schedules/:id/allocation/run-job",
  checkPermission("admitCards", "edit"),
  validate(allocationOptionsSchema),
  auditLog("AdmitCards", "ALLOCATE"),
  examController.enqueueAllocation,
);
router.post(
  "/schedules/:id/allocation/lock",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "LOCK"),
  examController.lockAllocation,
);
router.get(
  "/schedules/:id/allocations",
  checkPermission("admitCards", "view"),
  examController.listAllocations,
);
router.post(
  "/schedules/:id/admit-cards/generate",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "GENERATE"),
  examController.generateAdmitCards,
);
router.post(
  "/schedules/:id/admit-cards/generate-job",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "GENERATE"),
  examController.enqueueAdmitCardGeneration,
);
router.post(
  "/schedules/:id/admit-cards/publish",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "PUBLISH"),
  examController.publishAdmitCards,
);
router.post(
  "/schedules/:id/admit-cards/unpublish",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "UNPUBLISH"),
  examController.unpublishAdmitCards,
);
router.post(
  "/schedules/:id/admit-cards/regenerate",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "REGENERATE"),
  examController.regenerateAdmitCards,
);
router.get(
  "/schedules/:id/admit-cards",
  checkPermission("admitCards", "view"),
  examController.listAdmitCards,
);
router.get(
  "/admit-cards/:admitCardId/html",
  checkPermission("admitCards", "download"),
  examController.renderAdmitCardHtml,
);
router.get(
  "/admit-cards/:admitCardId/pdf",
  checkPermission("admitCards", "download"),
  examController.downloadAdmitCardPdf,
);
router.get(
  "/schedules/:id/attendance-sheet/html",
  checkPermission("admitCards", "download"),
  examController.renderAttendanceSheetHtml,
);
router.get(
  "/schedules/:id/attendance-sheet/pdf",
  checkPermission("admitCards", "download"),
  examController.downloadAttendanceSheetPdf,
);
router.post(
  "/schedules/:id/bulk/admit-cards",
  checkPermission("admitCards", "download"),
  auditLog("AdmitCards", "BULK_DOWNLOAD"),
  examController.enqueueAdmitCardZip,
);
router.post(
  "/schedules/:id/bulk/attendance",
  checkPermission("admitCards", "download"),
  auditLog("AdmitCards", "BULK_DOWNLOAD"),
  examController.enqueueAttendanceZip,
);
router.get(
  "/jobs/:jobId",
  checkPermission("admitCards", "view"),
  examController.getBulkJob,
);
router.post(
  "/jobs/:jobId/retry",
  checkPermission("admitCards", "edit"),
  auditLog("AdmitCards", "RETRY"),
  examController.retryBulkJob,
);
router.get(
  "/jobs/:jobId/download",
  checkPermission("admitCards", "download"),
  auditLog("AdmitCards", "DOWNLOAD"),
  examController.downloadBulkJob,
);

module.exports = router;
