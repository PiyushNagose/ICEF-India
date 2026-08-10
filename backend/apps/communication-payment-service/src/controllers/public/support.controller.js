const { StatusCodes } = require("http-status-codes");
const supportService = require("../../shared/services/support.service");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");

const submitEnquiry = asyncHandler(async (req, res) => {
  const ticket = await supportService.createPublicTicket(req.body, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Support enquiry submitted", {
      ticketId: ticket.ticketId,
      ticketObjectId: ticket._id,
      status: ticket.status,
      sla: ticket.sla,
      message:
        "Your support ticket has been created. Keep the ticket ID for follow-up.",
    }),
  );
});

const lookupTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.getPublicTicket(req.body);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Support ticket fetched", { ticket }));
});

const replyToTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.addPublicReply(req.body);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Reply submitted", { ticket }));
});

module.exports = { submitEnquiry, lookupTicket, replyToTicket };
