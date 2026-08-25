const express = require("express");
const router = express.Router();
const admitCardTemplateController = require("../../controllers/admin/admitCardTemplate.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");

router.use(authenticate);
router.use(authorize("admin", "superadmin"));

router
  .route("/")
  .get(admitCardTemplateController.getTemplates)
  .post(admitCardTemplateController.createTemplate);

router
  .route("/:id")
  .put(admitCardTemplateController.updateTemplate)
  .delete(admitCardTemplateController.deleteTemplate);

module.exports = router;
