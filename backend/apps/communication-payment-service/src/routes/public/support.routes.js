const express = require("express");
const router = express.Router();
const supportController = require("../../controllers/public/support.controller");
const validate = require("../../shared/middlewares/validate");
const {
  publicEnquirySchema,
  publicTicketLookupSchema,
  publicTicketReplySchema,
} = require("../../shared/validations/support.validation");

router.post("/enquiry", validate(publicEnquirySchema), supportController.submitEnquiry);
router.post("/lookup", validate(publicTicketLookupSchema), supportController.lookupTicket);
router.post("/reply", validate(publicTicketReplySchema), supportController.replyToTicket);

module.exports = router;
