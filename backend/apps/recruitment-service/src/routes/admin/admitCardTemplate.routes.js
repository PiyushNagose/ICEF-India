const express = require("express");
const router = express.Router();
const admitCardTemplateController = require("../../controllers/admin/admitCardTemplate.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");

router.use(authenticate, authorize("admin", "employee"));

router
  .route("/")
  .get(checkPermission("admitCards", "view"), admitCardTemplateController.getTemplates)
  .post(checkPermission("admitCards", "create"), admitCardTemplateController.createTemplate);

router
  .route("/:id")
  .put(checkPermission("admitCards", "edit"), admitCardTemplateController.updateTemplate)
  .delete(checkPermission("admitCards", "delete"), admitCardTemplateController.deleteTemplate);

module.exports = router;
