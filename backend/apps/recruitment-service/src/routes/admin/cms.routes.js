const express = require("express");
const router = express.Router();
const cms = require("../../controllers/admin/cms.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const { upload } = require("../../shared/services/upload.service");

router.use(authenticate, authorize("admin", "employee"));

// Image upload — must be registered before generic /:state routes
router.post("/upload-image", upload.single("image"), cms.uploadBannerImage);

router.get("/",               cms.getAll);
router.get("/activity",       cms.getActivity);
router.post("/",              cms.create);
router.get("/:state",         cms.getOne);
router.put("/:state",         auditLog("CMS", "UPDATE"), cms.update);
router.put("/:state/publish", cms.publish);
router.delete("/:state",      auditLog("CMS", "DELETE"), cms.remove);

module.exports = router;
