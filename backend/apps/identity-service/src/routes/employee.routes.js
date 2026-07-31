const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.controller");
const authenticate = require("../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../shared/middlewares/authorize");
const { auditLog } = require("../shared/middlewares/auditLog");
const validate = require("../shared/middlewares/validate");
const {
  createEmployeeSchema,
  updateEmployeeSchema,
} = require("../shared/validations/employee.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("employees", "view"), employeeController.getEmployees);
router.get("/stats", checkPermission("employees", "view"), employeeController.getEmployeeStats);
router.get("/:id", checkPermission("employees", "view"), employeeController.getEmployee);
router.post(
  "/",
  checkPermission("employees", "create"),
  validate(createEmployeeSchema),
  auditLog("Employees", "CREATE"),
  employeeController.createEmployee,
);
router.put(
  "/:id",
  checkPermission("employees", "edit"),
  validate(updateEmployeeSchema),
  auditLog("Employees", "UPDATE"),
  employeeController.updateEmployee,
);
router.delete(
  "/:id",
  checkPermission("employees", "delete"),
  auditLog("Employees", "DELETE"),
  employeeController.deleteEmployee,
);

module.exports = router;


