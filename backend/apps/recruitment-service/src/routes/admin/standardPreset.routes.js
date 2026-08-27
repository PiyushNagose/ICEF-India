const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/admin/standardPreset.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", checkPermission("standardsSettings", "view"), ctrl.getAll);
router.post("/", checkPermission("standardsSettings", "create"), ctrl.create);
router.put("/:id", checkPermission("standardsSettings", "edit"), auditLog("Standards Settings", "UPDATE"), ctrl.update);
router.delete("/:id", checkPermission("standardsSettings", "delete"), auditLog("Standards Settings", "DELETE"), ctrl.remove);

module.exports = router;
