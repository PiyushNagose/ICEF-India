const express = require("express");
const router = express.Router();
const supportController = require("../../controllers/admin/support.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");
const { auditLog } = require("../../shared/middlewares/auditLog");
const validate = require("../../shared/middlewares/validate");
const {
  updateTicketSchema,
  addReplySchema,
  ticketActionSchema,
} = require("../../shared/validations/support.validation");

router.use(authenticate, authorize("admin", "employee"));

// Stats must come BEFORE /:id to avoid being matched as a param
router.get("/stats", supportController.getStats);
router.get("/tickets", supportController.getTickets);
router.get("/tickets/:id", supportController.getTicketById);
router.put(
  "/tickets/:id",
  validate(updateTicketSchema),
  auditLog("Support", "UPDATE"),
  supportController.updateTicket,
);
router.post(
  "/tickets/:id/reply",
  validate(addReplySchema),
  supportController.addReply,
);
router.post(
  "/tickets/:id/request-correction",
  validate(ticketActionSchema),
  auditLog("Support", "UPDATE"),
  supportController.requestCorrection,
);
router.post(
  "/tickets/:id/verify-payment",
  validate(ticketActionSchema),
  auditLog("Support", "UPDATE"),
  supportController.verifyPayment,
);

module.exports = router;
