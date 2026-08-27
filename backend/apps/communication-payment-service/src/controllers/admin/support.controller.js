const { StatusCodes } = require("http-status-codes");
const supportService = require("../../shared/services/support.service");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");

// Import at top level so mongoose registers these models before any populate calls
const Employee = require("../../shared/models/Employee");
const SupportTicket = require("../../shared/models/SupportTicket");

const buildDateFilter = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return {};

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return {};

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { createdAt: { $gte: start, $lte: end } };
};

const getTickets = asyncHandler(async (req, res) => {
  const result = await supportService.getAdminTickets(req.query);
  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(
        StatusCodes.OK,
        "Tickets fetched",
        result.tickets,
        result.meta,
      ),
    );
});

const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicketById(req.params.id);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Ticket fetched", { ticket }));
});

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.updateTicket(
    req.params.id,
    req.body,
    req.user.id,
  );
  await saveAuditLog(
    req,
    `Updated ticket ${ticket.ticketId} — status: ${ticket.status}`,
  );
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Ticket updated", { ticket }));
});

const addReply = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.user.id).select("fullName");
  const ticket = await supportService.addReply(
    req.params.id,
    req.body.message,
    req.user.id,
    "Employee",
    employee?.fullName || "Admin",
  );
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Reply added", { ticket }));
});

const requestCorrection = asyncHandler(async (req, res) => {
  const ticket = await supportService.requestApplicationCorrection(
    req.params.id,
    req.user.id,
    req.body.note,
  );
  await saveAuditLog(req, `Requested correction for ticket ${ticket.ticketId}`);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Correction requested", { ticket }),
  );
});

const verifyPayment = asyncHandler(async (req, res) => {
  const ticket = await supportService.verifyPaymentForTicket(
    req.params.id,
    req.user.id,
    req.body.note,
  );
  await saveAuditLog(req, `Verified payment from support ticket ${ticket.ticketId}`);
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Payment verified and ticket resolved", {
      ticket,
    }),
  );
});

const getStats = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query);
  const [statusStats, priorityStats, categoryStats, recentTickets] =
    await Promise.all([
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      SupportTicket.find(dateFilter)
        .populate("raisedBy", "fullName email")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("ticketId title priority status createdAt"),
    ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Support stats fetched", {
      statusStats,
      priorityStats,
      categoryStats,
      recentTickets,
    }),
  );
});

module.exports = {
  getTickets,
  getTicketById,
  updateTicket,
  addReply,
  requestCorrection,
  verifyPayment,
  getStats,
};
