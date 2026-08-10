const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../utils/logger");

let io = null;
const NORMAL_DISCONNECT_REASONS = new Set([
  "client namespace disconnect",
  "server namespace disconnect",
  "transport close",
]);

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const parsedOrigins = env.CLIENT_URL?.split(",")
  .map(normalizeOrigin)
  .filter(Boolean) || ["http://localhost:5173"];

/**
 * Initialize Socket.IO on the HTTP server.
 * Called once from server.js
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: parsedOrigins.length > 1 ? parsedOrigins : parsedOrigins[0],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware for socket connections ────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      // Allow unauthenticated connections for public rooms
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.user = decoded;
      next();
    } catch {
      socket.user = null;
      next(); // still allow — public events work without auth
    }
  });

  // ── Connection handler ────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.user?.id || "anonymous";
    const role = socket.user?.role || "public";
    logger.debug(
      `Socket connected: ${socket.id} | user: ${userId} | role: ${role}`,
    );

    // Join personal room for targeted notifications
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Admin/employee joins admin room for live dashboard updates
    if (role === "admin" || role === "employee") {
      socket.join("admin:room");
    }

    // Candidate joins their own room
    if (role === "candidate") {
      socket.join(`candidate:${socket.user.id}`);
    }

    socket.on("disconnect", (reason) => {
      const message = `Socket disconnected: ${socket.id} | reason: ${reason}`;
      if (NORMAL_DISCONNECT_REASONS.has(reason)) logger.silly(message);
      else logger.debug(message);
    });

    socket.on("error", (err) => {
      logger.error(`Socket error [${socket.id}]: ${err.message}`);
    });
  });

  logger.info("Socket.IO initialized");
  return io;
};

/**
 * Get the Socket.IO instance anywhere in the app.
 */
const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

// ── Emit helpers ─────────────────────────────────────────────

/** Emit to a specific user (candidate or employee) */
const emitToUser = (userId, event, data) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

/** Emit to all connected admins/employees */
const emitToAdmins = (event, data) => {
  getIO().to("admin:room").emit(event, data);
};

/** Emit to a specific candidate */
const emitToCandidate = (candidateId, event, data) => {
  getIO().to(`candidate:${candidateId}`).emit(event, data);
};

/** Broadcast to everyone */
const emitBroadcast = (event, data) => {
  getIO().emit(event, data);
};

// ── Named socket events (single source of truth) ─────────────
const SOCKET_EVENTS = {
  // Dashboard
  DASHBOARD_STATS_UPDATE: "dashboard:stats:update",
  APPLICATION_FUNNEL_UPDATE: "dashboard:funnel:update",

  // Applications
  APPLICATION_SUBMITTED: "application:submitted",
  APPLICATION_STATUS_CHANGED: "application:status:changed",
  APPLICATION_NEW: "admin:application:new",
  APPLICATION_UPDATED: "application:updated",

  // Documents
  DOCUMENT_VERIFIED: "document:verified",
  DOCUMENT_REJECTED: "document:rejected",

  // Payments
  PAYMENT_SUCCESS: "payment:success",
  PAYMENT_FAILED: "payment:failed",

  // Jobs
  JOB_PUBLISHED: "job:published",
  JOB_CLOSED: "job:closed",

  // Support
  TICKET_CREATED: "support:ticket:created",
  TICKET_REPLY: "support:ticket:reply",
  TICKET_RESOLVED: "support:ticket:resolved",

  // Notifications
  NEW_NOTIFICATION: "notification:new",

  // Admin live counts
  ADMIN_LIVE_COUNT: "admin:live:count",
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToAdmins,
  emitToCandidate,
  emitBroadcast,
  SOCKET_EVENTS,
};
