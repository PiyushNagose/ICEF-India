const SupportTicket = require("../models/SupportTicket");
// Import models in order: Job before Application (for populate)
const Job = require("../models/Job");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Application = require("../models/Application");
const Payment = require("../models/Payment");
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
const { notify } = require("../utils/notify");
const { notifyAdmins } = require("../utils/notifyAdmins");

let ticketCounter = 1000;
const generateTicketId = () => `TKT-${Date.now()}-${++ticketCounter}`;
const SLA_HOURS = {
  Low: { first: 48, resolution: 120 },
  Medium: { first: 24, resolution: 72 },
  High: { first: 8, resolution: 48 },
  Critical: { first: 2, resolution: 24 },
};

const buildSla = (priority = "Medium") => {
  const hours = SLA_HOURS[priority] || SLA_HOURS.Medium;
  const now = Date.now();
  return {
    firstResponseDueAt: new Date(now + hours.first * 60 * 60 * 1000),
    resolutionDueAt: new Date(now + hours.resolution * 60 * 60 * 1000),
  };
};

const normalizeContact = (value = "") => String(value).trim().toLowerCase();

const contactMatchesTicket = (ticket, contact) => {
  const normalized = normalizeContact(contact);
  const mobile = String(ticket.guestContact?.mobile || "").trim();
  const email = normalizeContact(ticket.guestContact?.email || ticket.raisedByEmail);
  const candidateEmail = normalizeContact(ticket.raisedBy?.email);
  const candidateMobile = String(ticket.raisedBy?.registeredMobile || "").trim();

  return (
    normalized === email ||
    normalized === candidateEmail ||
    normalized === mobile ||
    normalized === candidateMobile
  );
};

const sanitizePublicTicket = (ticket) => ({
  ticketId: ticket.ticketId,
  title: ticket.title,
  description: ticket.description,
  category: ticket.category,
  priority: ticket.priority,
  status: ticket.status,
  source: ticket.source,
  registrationNumber: ticket.registrationNumber,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  resolvedAt: ticket.resolvedAt,
  closedAt: ticket.closedAt,
  sla: ticket.sla,
  linkedApplication: ticket.linkedApplication
    ? {
        applicationId: ticket.linkedApplication.applicationId,
        status: ticket.linkedApplication.status,
        paymentStatus: ticket.linkedApplication.paymentStatus,
      }
    : null,
  replies: (ticket.replies || []).map((reply) => ({
    message: reply.message,
    sentByModel: reply.sentByModel,
    sentByName:
      reply.sentByModel === "Employee"
        ? reply.sentByName || "Support Team"
        : "Candidate",
    createdAt: reply.createdAt,
  })),
});

const createTicket = async (data, candidateId, email) => {
  const ticketData = { ...data };
  delete ticketData.linkedApplicationId;
  delete ticketData.transactionId;

  if (data.linkedApplicationId) {
    const appQuery = data.linkedApplicationId.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: data.linkedApplicationId }
      : { applicationId: data.linkedApplicationId };
    const application = await Application.findOne({
      ...appQuery,
      candidateId,
    }).select("_id");
    if (!application) throw new ApiError(400, "Linked application not found");
    ticketData.linkedApplication = application._id;
  }

  if (data.transactionId) {
    const payment = await Payment.findOne({
      transactionId: data.transactionId,
      candidateId,
    }).select("_id applicationId");
    if (!payment) throw new ApiError(400, "Linked payment not found");
    ticketData.linkedPayment = payment._id;
    ticketData.linkedApplication ||= payment.applicationId;
  }

  const ticket = await SupportTicket.create({
    ...ticketData,
    ticketId: generateTicketId(),
    raisedBy: candidateId,
    raisedByEmail: email,
    source: ticketData.source || "candidate_portal",
    sla: buildSla(ticketData.priority),
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

const createPublicTicket = async (data, requestMeta = {}) => {
  const ticketData = {
    title: data.title,
    description: data.description,
    category: data.category,
    priority: data.priority || "Medium",
    source: "web",
    sourceMetadata: requestMeta,
    guestContact: {
      name: data.name,
      email: data.email,
      mobile: data.mobile,
    },
    raisedByEmail: data.email,
    registrationNumber: data.registrationNumber,
    attachments: data.attachments || [],
    sla: buildSla(data.priority || "Medium"),
  };

  if (data.registrationNumber || data.applicationId) {
    const application = await Application.findOne({
      $or: [
        data.registrationNumber ? { registrationNumber: data.registrationNumber } : null,
        data.applicationId ? { applicationId: data.applicationId } : null,
      ].filter(Boolean),
    }).select("_id candidateId applicationId registrationNumber");

    if (application) {
      ticketData.linkedApplication = application._id;
      ticketData.raisedBy = application.candidateId;
      ticketData.registrationNumber =
        application.registrationNumber || data.registrationNumber;
    }
  }

  if (!ticketData.raisedBy && (data.email || data.mobile)) {
    const user = await User.findOne({
      $or: [
        data.email ? { email: data.email.toLowerCase() } : null,
        data.mobile ? { registeredMobile: data.mobile } : null,
      ].filter(Boolean),
    }).select("_id email registeredMobile");
    if (user) {
      ticketData.raisedBy = user._id;
      ticketData.raisedByEmail = user.email || data.email;
    }
  }

  const ticket = await SupportTicket.create({
    ...ticketData,
    ticketId: generateTicketId(),
  });

  emitToAdmins(SOCKET_EVENTS.TICKET_CREATED, {
    ticketId: ticket.ticketId,
    title: ticket.title,
    priority: ticket.priority,
    category: ticket.category,
    source: ticket.source,
  });

  await notifyAdmins({
    type: "general",
    title: "New Public Support Ticket",
    message: `${ticket.guestContact?.name || "Candidate"} submitted ${ticket.category} support ticket ${ticket.ticketId}.`,
    link: `/admin/support/ticket/${ticket._id}`,
    metadata: { ticketId: ticket.ticketId, source: ticket.source },
  });

  return ticket;
};

const getAdminTickets = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
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
    .populate(
      "linkedApplication",
      "applicationId registrationNumber status paymentStatus correction personalDetails totalFee transactionId jobId appliedPosts",
    )
    .populate(
      "linkedPayment",
      "transactionId amount status gateway paidAt applicationId",
    )
    .populate("replies.sentBy", "fullName");
  if (!ticket) throw new ApiError(404, "Ticket not found");
  return ticket;
};

const getPublicTicket = async ({ ticketId, contact }) => {
  const ticket = await SupportTicket.findOne({
    ticketId: String(ticketId || "").trim(),
  })
    .populate("raisedBy", "fullName email registeredMobile")
    .populate(
      "linkedApplication",
      "applicationId status paymentStatus registrationNumber",
    );

  if (!ticket || !contactMatchesTicket(ticket, contact)) {
    throw new ApiError(404, "Ticket not found for the provided details");
  }

  return sanitizePublicTicket(ticket);
};

const updateTicket = async (id, data, updatedBy) => {
  const ticket = await SupportTicket.findByIdAndUpdate(id, data, { new: true });
  if (!ticket) throw new ApiError(404, "Ticket not found");

  if (data.status === "Resolved") {
    ticket.resolvedAt = new Date();
    await ticket.save();

    // Notify candidate via socket
    if (ticket.raisedBy) {
      emitToCandidate(ticket.raisedBy.toString(), SOCKET_EVENTS.TICKET_RESOLVED, {
        ticketId: ticket.ticketId,
        message: "Your support ticket has been resolved.",
      });
    }

    // Persist notification in DB
    if (ticket.raisedBy) {
      await notify({
        recipientId: ticket.raisedBy,
        type: "ticket_resolved",
        title: "Support Ticket Resolved",
        message: `Your support ticket ${ticket.ticketId} has been resolved. Please close it if your issue is fixed.`,
        link: `/candidate/support/${id}`,
        metadata: { ticketId: ticket.ticketId },
      });
    }

    // Send email notification
    await sendTicketResolvedEmail(ticket.raisedByEmail, ticket.ticketId);
  }

  return ticket;
};

const addReply = async (ticketId, message, sentBy, sentByModel, sentByName) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");

  ticket.replies.push({ message, sentBy, sentByModel, sentByName });
  if (ticket.status === "Open") ticket.status = "In Progress";
  if (!ticket.sla?.firstRespondedAt && sentByModel === "Employee") {
    ticket.sla = {
      ...(ticket.sla?.toObject?.() || ticket.sla || {}),
      firstRespondedAt: new Date(),
    };
  }
  await ticket.save();

  // Notify the other party
  if (sentByModel === "Employee") {
    // Admin replied — notify candidate via socket
    if (ticket.raisedBy) {
      emitToCandidate(ticket.raisedBy.toString(), SOCKET_EVENTS.TICKET_REPLY, {
        ticketId: ticket.ticketId,
        message,
        from: sentByName,
      });
    }

    // Persist notification in DB for candidate
    if (ticket.raisedBy) {
      await notify({
        recipientId: ticket.raisedBy,
        type: "ticket_reply",
        title: "Support Team Replied",
        message: `${sentByName || "Support Team"} replied to your ticket ${ticket.ticketId}: "${message.substring(0, 80)}${message.length > 80 ? "..." : ""}"`,
        link: `/candidate/support/${ticketId}`,
        metadata: { ticketId: ticket.ticketId },
      });
    }

    // Send email notification
    await sendTicketReplyEmail(ticket.raisedByEmail, ticket.ticketId, message);
  } else {
    // Candidate replied — notify assigned admin via socket
    emitToAdmins(SOCKET_EVENTS.TICKET_REPLY, {
      ticketId: ticket.ticketId,
      message,
      from: sentByName,
    });
  }

  return ticket;
};

const addPublicReply = async ({ ticketId, contact, message }) => {
  const ticket = await SupportTicket.findOne({
    ticketId: String(ticketId || "").trim(),
  }).populate("raisedBy", "fullName email registeredMobile");

  if (!ticket || !contactMatchesTicket(ticket, contact)) {
    throw new ApiError(404, "Ticket not found for the provided details");
  }
  if (["Resolved", "Closed"].includes(ticket.status)) {
    throw new ApiError(400, "This ticket is already resolved or closed");
  }

  ticket.replies.push({
    message,
    sentBy: ticket.raisedBy?._id,
    sentByModel: ticket.raisedBy ? "User" : undefined,
    sentByName: ticket.guestContact?.name || ticket.raisedBy?.fullName || "Candidate",
  });
  if (ticket.status === "Open") ticket.status = "In Progress";
  await ticket.save();

  emitToAdmins(SOCKET_EVENTS.TICKET_REPLY, {
    ticketId: ticket.ticketId,
    message,
    from: ticket.guestContact?.name || "Candidate",
  });

  return getPublicTicket({ ticketId, contact });
};

const requestApplicationCorrection = async (ticketId, adminId, note) => {
  const ticket =
    await SupportTicket.findById(ticketId).populate("linkedApplication");
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (!ticket.linkedApplication) {
    throw new ApiError(400, "Link an application before requesting correction");
  }

  const application = await Application.findById(
    ticket.linkedApplication._id,
  ).populate("jobId", "applicationDeadline title");
  if (!application) throw new ApiError(404, "Linked application not found");

  // Check if application deadline has passed
  if (application.jobId?.applicationDeadline) {
    const deadline = new Date(application.jobId.applicationDeadline);
    const now = new Date();
    if (now > deadline) {
      throw new ApiError(
        400,
        `Cannot request correction. Application deadline (${deadline.toLocaleDateString()}) has passed.`,
      );
    }
  }

  application.correction = {
    status: "requested",
    requestedBy: adminId,
    requestedAt: new Date(),
    supportTicket: ticket._id,
    note: note || undefined,
  };
  await application.save();

  ticket.status = "In Progress";
  ticket.resolutionAction = {
    type: "application_correction",
    status: "candidate_action_required",
    requestedBy: adminId,
    requestedAt: new Date(),
    note: note || undefined,
  };
  ticket.replies.push({
    message:
      note ||
      "We have opened your application for correction. Please update the application and confirm once done.",
    sentBy: adminId,
    sentByModel: "Employee",
    sentByName: "Support Team",
  });
  await ticket.save();

  await notify({
    recipientId: ticket.raisedBy,
    type: "general",
    title: "Application Correction Requested",
    message: `Correction has been requested for application ${application.applicationId}. Please update it from your support ticket.`,
    link: `/candidate/support/${ticket._id}`,
    metadata: {
      ticketId: ticket.ticketId,
      applicationId: application.applicationId,
    },
  });

  emitToCandidate(ticket.raisedBy.toString(), SOCKET_EVENTS.NEW_NOTIFICATION, {
    type: "application_correction_requested",
    ticketId: ticket.ticketId,
    applicationId: application.applicationId,
  });

  return getTicketById(ticketId);
};

const completeCandidateAction = async (ticketId, candidateId) => {
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    raisedBy: candidateId,
  });
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (ticket.resolutionAction?.type !== "application_correction") {
    throw new ApiError(400, "No correction action is pending for this ticket");
  }
  if (ticket.resolutionAction.status !== "candidate_action_required") {
    throw new ApiError(400, "Correction action is not awaiting candidate");
  }

  if (ticket.linkedApplication) {
    const application = await Application.findById(
      ticket.linkedApplication,
    ).populate("jobId", "title");
    if (application) {
      application.correction.status = "submitted";
      application.correction.submittedAt = new Date();
      // Mark application for re-review
      application.status = "under_review";
      await application.save();

      // Notify all admins with detailed info
      await notifyAdmins({
        type: "application_updated",
        title: "Application Corrected - Needs Re-Review",
        message: `Candidate has submitted corrections for application ${application.applicationId}. Please review the updated application.`,
        link: `/admin/applications/${application._id}`,
        metadata: {
          applicationId: application.applicationId,
          ticketId: ticket.ticketId,
          jobTitle: application.jobId?.title,
        },
      });

      // Emit socket event to admins
      try {
        emitToAdmins(SOCKET_EVENTS.APPLICATION_UPDATED, {
          type: "correction_submitted",
          applicationId: application.applicationId,
          applicationNumber: application.applicationId,
          ticketId: ticket.ticketId,
          message: `Application ${application.applicationId} has been corrected and needs re-review`,
        });
      } catch (_) {}
    }
  }

  ticket.resolutionAction.status = "candidate_completed";
  ticket.resolutionAction.completedBy = candidateId;
  ticket.resolutionAction.completedByModel = "User";
  ticket.resolutionAction.completedAt = new Date();
  ticket.replies.push({
    message: "Candidate has completed the requested application correction.",
    sentBy: candidateId,
    sentByModel: "User",
    sentByName: "Candidate",
  });
  await ticket.save();

  notifyAdmins({
    type: "ticket_updated",
    title: "Correction Completed by Candidate",
    message: `Candidate completed correction for ticket ${ticket.ticketId}. Application is now under re-review.`,
    link: `/admin/support/tickets/${ticket._id}`,
    metadata: { ticketId: ticket.ticketId },
  });

  emitToAdmins(SOCKET_EVENTS.TICKET_REPLY, {
    ticketId: ticket.ticketId,
    message: "Candidate completed the requested correction.",
  });

  return getTicketById(ticketId);
};

const verifyPaymentForTicket = async (ticketId, adminId, note) => {
  const ticket = await SupportTicket.findById(ticketId)
    .populate("linkedPayment")
    .populate("linkedApplication");
  if (!ticket) throw new ApiError(404, "Ticket not found");

  let payment = ticket.linkedPayment;
  if (!payment && ticket.linkedApplication) {
    payment = await Payment.findOne({
      applicationId: ticket.linkedApplication._id,
    }).sort({ createdAt: -1 });
  }
  if (!payment) throw new ApiError(400, "Link a payment before verification");

  payment.status = "success";
  payment.failureReason = undefined;
  payment.paidAt = payment.paidAt || new Date();
  await payment.save();

  const application = await Application.findById(payment.applicationId);
  if (application) {
    application.paymentStatus = "paid";
    application.transactionId = payment.transactionId;
    application.status = "submitted";
    application.submittedAt = application.submittedAt || new Date();
    await application.save();
  }

  ticket.linkedPayment = payment._id;
  ticket.linkedApplication ||= payment.applicationId;
  ticket.status = "Resolved";
  ticket.resolvedAt = new Date();
  ticket.resolutionAction = {
    type: "payment_verification",
    status: "admin_completed",
    requestedBy: adminId,
    requestedAt: new Date(),
    completedBy: adminId,
    completedByModel: "Employee",
    completedAt: new Date(),
    note: note || undefined,
  };
  ticket.replies.push({
    message:
      note ||
      `Payment ${payment.transactionId} has been verified and your application payment status is updated.`,
    sentBy: adminId,
    sentByModel: "Employee",
    sentByName: "Support Team",
  });
  await ticket.save();

  await notify({
    recipientId: ticket.raisedBy,
    type: "payment_success",
    title: "Payment Verified",
    message: `Your payment ${payment.transactionId} has been verified successfully.`,
    link: `/candidate/support/${ticket._id}`,
    metadata: {
      ticketId: ticket.ticketId,
      transactionId: payment.transactionId,
    },
  });

  emitToCandidate(ticket.raisedBy.toString(), SOCKET_EVENTS.PAYMENT_SUCCESS, {
    transactionId: payment.transactionId,
    applicationId: application?.applicationId,
  });

  return getTicketById(ticketId);
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
  createPublicTicket,
  getPublicTicket,
  getAdminTickets,
  getTicketById,
  updateTicket,
  addReply,
  addPublicReply,
  requestApplicationCorrection,
  completeCandidateAction,
  verifyPaymentForTicket,
  getCandidateTickets,
};
