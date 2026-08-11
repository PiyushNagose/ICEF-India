const express = require("express");
const router = express.Router();
const activityLogController = require("../controllers/activityLog.controller");
const authenticate = require("../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../shared/middlewares/authorize");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("activityLogs", "view"), activityLogController.getActivityLogs);
router.get("/export", checkPermission("activityLogs", "download"), activityLogController.exportActivityLogs);
router.get(
  "/employee/:employeeId",
  checkPermission("activityLogs", "view"),
  activityLogController.getEmployeeActivityLogs,
);

module.exports = router;


