const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config({
  path: require("path").join(__dirname, "../../.env"),
});

const app = express();
const PORT = parseInt(process.env.PORT || process.env.API_GATEWAY_PORT, 10) || 5000;
const ID_PORT = parseInt(process.env.IDENTITY_SERVICE_PORT) || 5001;
const RC_PORT = parseInt(process.env.RECRUITMENT_SERVICE_PORT) || 5002;
const CM_PORT = parseInt(process.env.COMMUNICATION_SERVICE_PORT) || 5003;
const IDENTITY_URL =
  process.env.IDENTITY_SERVICE_URL || `http://localhost:${ID_PORT}`;
const RECRUITMENT_URL =
  process.env.RECRUITMENT_SERVICE_URL || `http://localhost:${RC_PORT}`;
const COMMUNICATION_URL =
  process.env.COMMUNICATION_SERVICE_URL || `http://localhost:${CM_PORT}`;
const parsedOrigins = process.env.CLIENT_URL?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) || ["http://localhost:5173"];
const requestTimeoutMs = 15000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: parsedOrigins.length > 1 ? parsedOrigins : parsedOrigins[0],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Health check ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
    services: {
      identity: IDENTITY_URL,
      recruitment: RECRUITMENT_URL,
      communication: COMMUNICATION_URL,
    },
  });
});

// ── Proxy helper ──────────────────────────────────────────────
const proxy = (target, label) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    pathRewrite: (path, req) => `${req.baseUrl}${path}`,
    proxyTimeout: 15000,
    timeout: 15000,
    on: {
      error: (err, _req, res) => {
        console.error(`❌ [${label}] ${err.message}`);
        if (!res.headersSent) {
          res
            .status(503)
            .json({ success: false, message: `${label} unavailable` });
        }
      },
    },
  });

const socketProxy = (target, label, routePrefix) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    proxyTimeout: 15000,
    timeout: 15000,
    pathRewrite: {
      [`^${routePrefix}/socket.io`]: "/socket.io",
    },
    on: {
      error: (err, _req, res) => {
        console.error(`âŒ [${label} Socket] ${err.message}`);
        if (res && !res.headersSent) {
          res
            .status(503)
            .json({ success: false, message: `${label} socket unavailable` });
        }
      },
    },
  });

const serviceUrl = (baseUrl, path) => `${baseUrl}${path}`;

class UpstreamHttpError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.name = "UpstreamHttpError";
    this.status = status;
    this.payload = payload;
  }
}

const callJson = async (url, authorization, cookie) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const headers = {};
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new UpstreamHttpError(
        payload?.message || `Request failed with ${response.status}`,
        response.status,
        payload,
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

app.get("/api/dashboard/admin", async (req, res) => {
  try {
    const authorization = req.headers.authorization || "";
    const cookie = req.headers.cookie || "";
    const [overview, funnel, topJobs, support, notifications] =
      await Promise.all([
        callJson(
          serviceUrl(RECRUITMENT_URL, "/api/admin/analytics/overview"),
          authorization,
          cookie,
        ),
        callJson(
          serviceUrl(RECRUITMENT_URL, "/api/admin/analytics/funnel"),
          authorization,
          cookie,
        ),
        callJson(
          serviceUrl(RECRUITMENT_URL, "/api/admin/analytics/top-jobs?limit=5"),
          authorization,
          cookie,
        ),
        callJson(
          serviceUrl(COMMUNICATION_URL, "/api/admin/support/stats"),
          authorization,
          cookie,
        ),
        callJson(
          serviceUrl(
            IDENTITY_URL,
            "/api/admin/notifications?limit=20&isRead=false",
          ),
          authorization,
          cookie,
        ),
      ]);

    res.json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: {
        overview: overview?.data ?? null,
        funnel: funnel?.data ?? null,
        topJobs: topJobs?.data?.topJobs || [],
        support: support?.data ?? null,
        notifications: notifications?.data ?? null,
      },
    });
  } catch (error) {
    console.error("❌ [Dashboard Admin]", error.message);
    if (error.status === 401 || error.status === 403) {
      return res.status(error.status).json({
        success: false,
        statusCode: error.status,
        message: error.message || "Session expired. Please login again.",
      });
    }

    res.status(503).json({
      success: false,
      message: "Unable to fetch admin dashboard data",
    });
  }
});

app.get("/api/dashboard/candidate", async (req, res) => {
  try {
    const authorization = req.headers.authorization || "";
    const cookie = req.headers.cookie || "";
    const [applications, notifications, tickets, jobs] = await Promise.all([
      callJson(
        serviceUrl(RECRUITMENT_URL, "/api/candidate/applications?limit=5"),
        authorization,
        cookie,
      ),
      callJson(
        serviceUrl(COMMUNICATION_URL, "/api/candidate/notifications?limit=5"),
        authorization,
        cookie,
      ),
      callJson(
        serviceUrl(COMMUNICATION_URL, "/api/candidate/support/tickets?limit=5"),
        authorization,
        cookie,
      ),
      callJson(
        serviceUrl(RECRUITMENT_URL, "/api/jobs?limit=5"),
        authorization,
        cookie,
      ),
    ]);

    res.json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: {
        applications: applications?.data ?? [],
        notifications: notifications?.data ?? null,
        tickets: tickets?.data ?? [],
        jobs: jobs?.data?.jobs || [],
        meta: applications?.meta || null,
      },
    });
  } catch (error) {
    console.error("❌ [Dashboard Candidate]", error.message);
    if (error.status === 401 || error.status === 403) {
      return res.status(error.status).json({
        success: false,
        statusCode: error.status,
        message: error.message || "Session expired. Please login again.",
      });
    }

    res.status(503).json({
      success: false,
      message: "Unable to fetch candidate dashboard data",
    });
  }
});

// ── Identity Service routes ───────────────────────────────────
app.use("/api/auth", proxy(IDENTITY_URL, "Identity"));
app.use("/api/admin/employees", proxy(IDENTITY_URL, "Identity"));
app.use("/api/admin/roles", proxy(IDENTITY_URL, "Identity"));
app.use("/api/admin/activity-logs", proxy(IDENTITY_URL, "Identity"));
app.use("/api/admin/notifications", proxy(IDENTITY_URL, "Identity"));

// ── Recruitment Service routes ────────────────────────────────
app.use("/api/jobs", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admit-cards", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/cms", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/public/projects", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/public/otp", proxy(IDENTITY_URL, "Identity"));
app.use("/api/public/apply", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/public/application", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/projects", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/jobs", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/applications", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/analytics", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/cms", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/admin/exams", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/candidate/applications", proxy(RECRUITMENT_URL, "Recruitment"));
app.use("/api/candidate/admit-cards", proxy(RECRUITMENT_URL, "Recruitment"));

// ── Communication & Payment Service routes ────────────────────
app.use("/api/admin/payments", proxy(COMMUNICATION_URL, "Communication"));
app.use(
  "/api/admin/payment-gateways",
  proxy(COMMUNICATION_URL, "Communication"),
);
app.use("/api/admin/support", proxy(COMMUNICATION_URL, "Communication"));
app.use(
  "/api/candidate/notifications",
  proxy(COMMUNICATION_URL, "Communication"),
);
app.use("/api/candidate/support", proxy(COMMUNICATION_URL, "Communication"));
app.use("/api/candidate/payments", proxy(COMMUNICATION_URL, "Communication"));

// â”€â”€ Socket.IO routes through gateway â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(
  "/realtime/identity",
  socketProxy(IDENTITY_URL, "Identity", "/realtime/identity"),
);
app.use(
  "/realtime/recruitment",
  socketProxy(RECRUITMENT_URL, "Recruitment", "/realtime/recruitment"),
);
app.use(
  "/realtime/communication",
  socketProxy(COMMUNICATION_URL, "Communication", "/realtime/communication"),
);

// ── Swagger redirect ──────────────────────────────────────────
app.get("/api/docs", (_req, res) => {
  res.redirect(`${RECRUITMENT_URL}/api/docs`);
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Error handler ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("❌ Gateway Error:", err.message);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
const server = http.createServer(app);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Run: npm run kill-ports`);
  } else {
    console.error("❌ Server error:", err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Docs:   http://localhost:${PORT}/api/docs`);
});

const shutdown = (signal) => {
  console.log(`⚠️ ${signal} received. Shutting down API Gateway.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
