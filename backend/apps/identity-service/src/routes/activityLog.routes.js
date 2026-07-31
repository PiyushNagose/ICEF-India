const express = require("express");
const router = express.Router();
const activityLogController = require("../controllers/activityLog.controller");
const authenticate = require("../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../shared/middlewares/authorize");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("employees", "view"), activityLogController.getActivityLogs);
router.get("/export", checkPermission("employees", "download"), activityLogController.exportActivityLogs);
router.get(
  "/employee/:employeeId",
  checkPermission("employees", "view"),
  activityLogController.getEmployeeActivityLogs,
);

module.exports = router;


