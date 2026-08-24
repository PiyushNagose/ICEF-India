const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/admin/standardPreset.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");

router.use(authenticate, authorize("admin", "employee"));

router.get("/", ctrl.getAll);
router.post("/", ctrl.create);
router.put("/:id", auditLog("Standards Settings", "UPDATE"), ctrl.update);
router.delete("/:id", auditLog("Standards Settings", "DELETE"), ctrl.remove);

module.exports = router;
