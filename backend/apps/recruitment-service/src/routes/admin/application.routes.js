const express = require("express");
const router = express.Router();
const applicationController = require("../../controllers/admin/application.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const validate = require("../../shared/middlewares/validate");
const {
  updateStatusSchema,
  bulkActionSchema,
  reviewCorrectionSchema,
} = require("../../shared/validations/application.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get(
  "/",
  checkPermission("applications", "view"),
  applicationController.getApplications,
);
router.get(
  "/stats",
  checkPermission("applications", "view"),
  applicationController.getApplicationStats,
);
router.get(
  "/:id",
  checkPermission("applications", "view"),
  applicationController.getApplication,
);
router.put(
  "/:id/status",
  checkPermission("applications", "edit"),
  validate(updateStatusSchema),
  auditLog("Applications", "UPDATE"),
  applicationController.updateApplicationStatus,
);
router.put(
  "/:id/correction-review",
  checkPermission("applications", "edit"),
  validate(reviewCorrectionSchema),
  auditLog("Applications", "UPDATE"),
  applicationController.reviewCorrection,
);
router.post(
  "/bulk-action",
  checkPermission("applications", "edit"),
  validate(bulkActionSchema),
  auditLog("Applications", "UPDATE"),
  applicationController.bulkUpdateApplications,
);
router.put(
  "/:id/documents/:documentId/verify",
  checkPermission("applications", "edit"),
  auditLog("Applications", "UPDATE"),
  applicationController.verifyDocument,
);
router.put(
  "/:id/documents/:documentId/reject",
  checkPermission("applications", "edit"),
  auditLog("Applications", "UPDATE"),
  applicationController.rejectDocument,
);

module.exports = router;

