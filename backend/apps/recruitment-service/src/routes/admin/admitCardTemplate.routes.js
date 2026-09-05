const express = require("express");
const router = express.Router();
const admitCardTemplateController = require("../../controllers/admin/admitCardTemplate.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");

router.use(authenticate, authorize("admin", "employee"));

router
  .route("/")
  .get(checkPermission("admitCards", "view"), admitCardTemplateController.getTemplates)
  .post(checkPermission("admitCards", "create"), auditLog("AdmitCards", "CREATE"), admitCardTemplateController.createTemplate);

router
  .route("/:id")
  .put(checkPermission("admitCards", "edit"), auditLog("AdmitCards", "UPDATE"), admitCardTemplateController.updateTemplate)
  .delete(checkPermission("admitCards", "delete"), auditLog("AdmitCards", "DELETE"), admitCardTemplateController.deleteTemplate);

module.exports = router;
