const express = require("express");
const router = express.Router();
const jobController = require("../../controllers/admin/job.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const validate = require("../../shared/middlewares/validate");
const {
  createJobSchema,
  updateJobSchema,
} = require("../../shared/validations/job.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("jobs", "view"), jobController.getJobs);
router.get(
  "/stats",
  checkPermission("jobs", "view"),
  jobController.getJobStats,
);
router.get(
  "/by-postcode/:postCode",
  checkPermission("jobs", "view"),
  jobController.getJobByPostCode,
);
router.get("/:id", checkPermission("jobs", "view"), jobController.getJob);
router.post(
  "/",
  checkPermission("jobs", "create"),
  validate(createJobSchema),
  auditLog("Jobs", "CREATE"),
  jobController.createJob,
);
router.put(
  "/:id",
  checkPermission("jobs", "edit"),
  validate(updateJobSchema),
  auditLog("Jobs", "UPDATE"),
  jobController.updateJob,
);
router.put(
  "/:id/publish",
  checkPermission("jobs", "publish"),
  auditLog("Jobs", "PUBLISH"),
  jobController.publishJob,
);
router.put(
  "/:id/close",
  checkPermission("jobs", "edit"),
  auditLog("Jobs", "UPDATE"),
  jobController.closeJob,
);
router.delete(
  "/:id",
  checkPermission("jobs", "delete"),
  auditLog("Jobs", "DELETE"),
  jobController.deleteJob,
);

module.exports = router;

