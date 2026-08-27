const express = require("express");
const router = express.Router();
const cms = require("../../controllers/admin/cms.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize, checkPermission } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const { upload } = require("../../shared/services/upload.service");

router.use(authenticate, authorize("admin", "employee"));

// Image upload — must be registered before generic /:state routes
router.post("/upload-image", checkPermission("cms", "edit"), upload.single("image"), cms.uploadBannerImage);

router.get("/",               checkPermission("cms", "view"), cms.getAll);
router.get("/activity",       checkPermission("cms", "view"), cms.getActivity);
router.post("/",              checkPermission("cms", "create"), cms.create);
router.get("/:state",         checkPermission("cms", "view"), cms.getOne);
router.put("/:state",         checkPermission("cms", "edit"), auditLog("CMS", "UPDATE"), cms.update);
router.put("/:state/publish", checkPermission("cms", "publish"), cms.publish);
router.delete("/:state",      checkPermission("cms", "delete"), auditLog("CMS", "DELETE"), cms.remove);

module.exports = router;
