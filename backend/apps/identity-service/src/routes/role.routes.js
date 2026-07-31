const express = require("express");
const router = express.Router();
const roleController = require("../controllers/role.controller");
const authenticate = require("../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../shared/middlewares/authorize");
const { auditLog } = require("../shared/middlewares/auditLog");
const validate = require("../shared/middlewares/validate");
const {
  createRoleSchema,
  updateRoleSchema,
} = require("../shared/validations/role.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("employees", "view"), roleController.getRoles);
router.get("/permissions/structure", checkPermission("employees", "view"), roleController.getPermissionsStructure);
router.get("/:id", checkPermission("employees", "view"), roleController.getRole);
router.post(
  "/",
  checkPermission("employees", "create"),
  validate(createRoleSchema),
  auditLog("Roles", "CREATE"),
  roleController.createRole,
);
router.put(
  "/:id",
  checkPermission("employees", "edit"),
  validate(updateRoleSchema),
  auditLog("Roles", "UPDATE"),
  roleController.updateRole,
);
router.delete(
  "/:id",
  checkPermission("employees", "delete"),
  auditLog("Roles", "DELETE"),
  roleController.deleteRole,
);

module.exports = router;


