const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config({
  path: require("path").join(__dirname, "../../.env"),
});
require("express-async-errors");

// ── Packages (shared) ─────────────────────────────────────────
const connectDB = require("./src/shared/config/database");
const { connectRedis } = require("./src/shared/config/redis");
const { connectCloudinary } = require("./src/shared/config/cloudinary");
const { initSocket } = require("./src/shared/socket/index");
const env = require("./src/shared/config/env");
const logger = require("./src/shared/utils/logger");
const errorHandler = require("./src/shared/middlewares/errorHandler");
const notFound = require("./src/shared/middlewares/notFound");
const { apiLimiter } = require("./src/shared/middlewares/rateLimiter");

// ── Swagger (uses shared docs) ────────────────────────────────
const swaggerSpec = require("./src/docs/swagger");

// ── Service-local routes ──────────────────────────────────────
const publicJobRoutes = require("./src/routes/public/job.routes");
const publicCmsRoutes = require("./src/routes/public/cms.routes");
const publicAdmitCardRoutes = require("./src/routes/public/admitCard.routes");
const publicProjectRoutes = require("./src/routes/public/project.routes");
const publicApplicationRoutes = require("./src/routes/public/application.routes");
const publicStatusRoutes = require("./src/routes/public/status.routes");
const adminProjectRoutes = require("./src/routes/admin/project.routes");
const adminJobRoutes = require("./src/routes/admin/job.routes");
const adminApplicationRoutes = require("./src/routes/admin/application.routes");
const adminAnalyticsRoutes = require("./src/routes/admin/analytics.routes");
const adminCmsRoutes = require("./src/routes/admin/cms.routes");
const adminExamRoutes = require("./src/routes/admin/exam.routes");
const adminAdmitCardTemplateRoutes = require("./src/routes/admin/admitCardTemplate.routes");
const candidateApplicationRoutes = require("./src/routes/candidate/application.routes");
const candidateAdmitCardRoutes = require("./src/routes/candidate/admitCard.routes");

const PORT = parseInt(process.env.RECRUITMENT_SERVICE_PORT, 10) || 5002;
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const parsedOrigins = Array.from(
  new Set([
    ...(env.CLIENT_URL?.split(",").map(normalizeOrigin).filter(Boolean) || []),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),
);
const frameAncestors = ["'self'", ...parsedOrigins];

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        frameAncestors,
      },
    },
  }),
);
app.use(
  cors({
    origin: parsedOrigins.length > 1 ? parsedOrigins : parsedOrigins[0],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(compression());
app.use(morgan(env.isDevelopment ? "dev" : "combined"));
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.URL_ENCODED_BODY_LIMIT }));
app.use(cookieParser());

// ── Swagger ───────────────────────────────────────────────────
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Recruitment Portal API",
    customCss: ".swagger-ui .topbar { background-color: #ea580c; }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  }),
);
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ── Routes ────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api/jobs", publicJobRoutes);
app.use("/api/cms/state", publicCmsRoutes);
app.use("/api/admit-cards", publicAdmitCardRoutes);
app.use("/api/public/projects", publicProjectRoutes);
app.use("/api/public/apply", publicApplicationRoutes);
app.use("/api/public/application", publicStatusRoutes);
app.use("/api/admin/projects", adminProjectRoutes);
app.use("/api/admin/jobs", adminJobRoutes);
app.use("/api/admin/applications", adminApplicationRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/cms", adminCmsRoutes);
app.use("/api/admin/exams", adminExamRoutes);
app.use("/api/admin/admit-card-templates", adminAdmitCardTemplateRoutes);
app.use("/api/candidate/applications", candidateApplicationRoutes);
app.use("/api/candidate/admit-cards", candidateAdmitCardRoutes);

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "Recruitment Service",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  connectRedis();
  connectCloudinary();

  // Initialize email service
  const { sendEmail } = require("./src/shared/services/email.service");

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  // Initialize cron jobs
  const { startJobStatusCron } = require("./src/shared/cron/jobStatus.cron");
  startJobStatusCron();

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE")
      logger.error(`Port ${PORT} already in use. Run: npm run kill-ports`);
    else logger.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    logger.info(`📋 Recruitment Service running on port ${PORT}`);
    console.log(`📋 Recruitment Service: http://localhost:${PORT}`);
    console.log(`   Swagger: http://localhost:${PORT}/api/docs`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down Recruitment Service.`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((err) => {
  logger.error(`Failed to start Recruitment Service: ${err.message}`);
  process.exit(1);
});

module.exports = app;
