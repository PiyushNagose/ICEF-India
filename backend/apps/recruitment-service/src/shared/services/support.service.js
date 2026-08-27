const SupportTicket = require("../models/SupportTicket");
const ApiError = require("../utils/ApiError");
const { getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const {
  emitToAdmins,
  emitToCandidate,
  emitToUser,
  SOCKET_EVENTS,
} = require("../socket/index");
const {
  sendTicketReplyEmail,
  sendTicketResolvedEmail,
} = require("./email.service");

let ticketCounter = 1000;
const generateTicketId = () => `TKT-${Date.now()}-${++ticketCounter}`;

const STATUS_VALUES = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_VALUES = ["Low", "Medium", "High", "Critical"];

const normalizeOption = (value, allowedValues) => {
  if (!value || typeof value !== "string") return value;
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ").trim();
  return (
    allowedValues.find(
      (option) => option.toLowerCase() === normalizedValue,
    ) || value
  );
};

const normalizeTicketData = (data = {}) => {
  const normalized = { ...data };
  if (normalized.status) {
    normalized.status = normalizeOption(normalized.status, STATUS_VALUES);
  }
  if (normalized.priority) {
    normalized.priority = normalizeOption(normalized.priority, PRIORITY_VALUES);
  }
  return normalized;
};

const createTicket = async (data, candidateId, email) => {
  const ticket = await SupportTicket.create({
    ...data,
    ticketId: generateTicketId(),
    raisedBy: candidateId,
    raisedByEmail: email,
  });

  // Notify all admins in real-time
  emitToAdmins(SOCKET_EVENTS.TICKET_CREATED, {
    ticketId: ticket.ticketId,
    title: ticket.title,
    priority: ticket.priority,
    category: ticket.category,
  });

  return ticket;
};

const getAdminTickets = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = normalizeOption(query.status, STATUS_VALUES);
  if (query.priority) {
    filter.priority = normalizeOption(query.priority, PRIORITY_VALUES);
  }
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate("raisedBy", "fullName email")
      .populate("assignedTo", "fullName employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(filter),
  ]);

  return { tickets, meta: paginationMeta(total, page, limit) };
};

const getTicketById = async (id) => {
  const ticket = await SupportTicket.findById(id)
    .populate("raisedBy", "fullName email registeredMobile")
    .populate("assignedTo", "fullName employeeId")
    .populate("replies.sentBy", "fullName");
  if (!ticket) throw new ApiError(404, "Ticket not found");
  return ticket;
};

const updateTicket = async (id, data, updatedBy) => {
  const updates = normalizeTicketData(data);
  const ticket = await SupportTicket.findByIdAndUpdate(id, updates, {
    new: true,
  });
  if (!ticket) throw new ApiError(404, "Ticket not found");

  if (updates.status === "Resolved") {
    ticket.resolvedAt = ticket.resolvedAt || new Date();
    await ticket.save();

    // Notify candidate
    if (ticket.raisedBy) {
      emitToCandidate(
        ticket.raisedBy.toString(),
        SOCKET_EVENTS.TICKET_RESOLVED,
        {
          ticketId: ticket.ticketId,
          message: "Your support ticket has been resolved.",
        },
      );
    }

    // Send email notification
    if (ticket.raisedByEmail) {
      await sendTicketResolvedEmail(ticket.raisedByEmail, ticket.ticketId);
    }
  }

  if (updates.status === "Closed" && !ticket.closedAt) {
    ticket.closedAt = new Date();
    await ticket.save();
  }

  return ticket;
};

const addReply = async (ticketId, message, sentBy, sentByModel, sentByName) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");

  ticket.replies.push({ message, sentBy, sentByModel, sentByName });
  if (ticket.status === "Open") ticket.status = "In Progress";
  await ticket.save();

  // Notify the other party
  if (sentByModel === "Employee") {
    // Admin replied — notify candidate
    if (ticket.raisedBy) {
      emitToCandidate(ticket.raisedBy.toString(), SOCKET_EVENTS.TICKET_REPLY, {
        ticketId: ticket.ticketId,
        message,
        from: sentByName,
      });
    }

    // Send email notification
    if (ticket.raisedByEmail) {
      await sendTicketReplyEmail(ticket.raisedByEmail, ticket.ticketId, message);
    }
  } else {
    // Candidate replied — notify assigned admin
    emitToAdmins(SOCKET_EVENTS.TICKET_REPLY, {
      ticketId: ticket.ticketId,
      message,
      from: sentByName,
    });
  }

  return ticket;
};

const getCandidateTickets = async (candidateId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = { raisedBy: candidateId };
  if (query.status) filter.status = query.status;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .select("-replies")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(filter),
  ]);

  return { tickets, meta: paginationMeta(total, page, limit) };
};

module.exports = {
  createTicket,
  getAdminTickets,
  getTicketById,
  updateTicket,
  addReply,
  getCandidateTickets,
};
