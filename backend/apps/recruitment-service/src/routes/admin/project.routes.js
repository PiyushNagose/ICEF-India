const express = require("express");
const router = express.Router();
const projectController = require("../../controllers/admin/project.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const validate = require("../../shared/middlewares/validate");
const {
  createProjectSchema,
  updateProjectSchema,
} = require("../../shared/validations/project.validation");

router.use(authenticate, authorize("admin", "employee"));

router.get(
  "/",
  checkPermission("projects", "view"),
  projectController.getProjects,
);
router.get(
  "/stats",
  checkPermission("projects", "view"),
  projectController.getProjectStats,
);
router.get(
  "/:id",
  checkPermission("projects", "view"),
  projectController.getProject,
);
router.get(
  "/:id/preview",
  checkPermission("projects", "view"),
  projectController.getProjectPreview,
);
router.post(
  "/",
  checkPermission("projects", "create"),
  validate(createProjectSchema),
  auditLog("Projects", "CREATE"),
  projectController.createProject,
);
router.put(
  "/:id/publish",
  checkPermission("projects", "publish"),
  auditLog("Projects", "PUBLISH"),
  projectController.publishProject,
);
router.put(
  "/:id",
  checkPermission("projects", "edit"),
  validate(updateProjectSchema),
  auditLog("Projects", "UPDATE"),
  projectController.updateProject,
);
router.delete(
  "/:id",
  checkPermission("projects", "delete"),
  auditLog("Projects", "DELETE"),
  projectController.deleteProject,
);

module.exports = router;

