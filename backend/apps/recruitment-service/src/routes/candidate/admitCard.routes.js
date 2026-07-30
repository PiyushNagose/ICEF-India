const express = require("express");
const router = express.Router();
const admitCardController = require("../../controllers/candidate/admitCard.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");

router.use(authenticate, authorize("candidate"));

router.get("/", admitCardController.getMyAdmitCards);
router.get("/:id/html", admitCardController.renderMyAdmitCardHtml);
router.get("/:id/pdf", admitCardController.downloadMyAdmitCardPdf);

module.exports = router;
