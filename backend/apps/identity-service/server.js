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

const swaggerSpec = require("./src/docs/swagger");

// ── Packages (shared) ─────────────────────────────────────────
const connectDB = require("./src/shared/config/database");
const { connectRedis } = require("./src/shared/config/redis");
const { connectCloudinary } = require("./src/shared/config/cloudinary");
const { initSocket } = require("./src/shared/socket/index");
const env = require("./src/shared/config/env");
const logger = require("./src/shared/utils/logger");
const errorHandler = require("./src/shared/middlewares/errorHandler");
const notFound = require("./src/shared/middlewares/notFound");

// ── Service-local routes ──────────────────────────────────────
const authRoutes = require("./src/routes/auth.routes");
const employeeRoutes = require("./src/routes/employee.routes");
const roleRoutes = require("./src/routes/role.routes");
const activityLogRoutes = require("./src/routes/activityLog.routes");
const adminNotificationRoutes = require("./src/routes/adminNotification.routes");
const publicOtpRoutes = require("./src/routes/publicOtp.routes");

const PORT = parseInt(process.env.IDENTITY_SERVICE_PORT, 10) || 5001;
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const parsedOrigins = env.CLIENT_URL?.split(",")
  .map(normalizeOrigin)
  .filter(Boolean) || ["http://localhost:5173"];

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Swagger Documentation ─────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth", authRoutes); // authLimiter is applied per-route inside auth.routes.js
app.use("/api/admin/employees", employeeRoutes);
app.use("/api/admin/roles", roleRoutes);
app.use("/api/admin/activity-logs", activityLogRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);

// ── Public Routes (NO AUTH REQUIRED) ──────────────────────────
app.use("/api/public/otp", publicOtpRoutes);

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "Identity Service",
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

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE")
      logger.error(`Port ${PORT} already in use. Run: npm run kill-ports`);
    else logger.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    logger.info(`🔐 Identity Service running on port ${PORT}`);
    console.log(`🔐 Identity Service: http://localhost:${PORT}`);
    console.log(`   Swagger: http://localhost:${PORT}/api/docs`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down Identity Service.`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((err) => {
  logger.error(`Failed to start Identity Service: ${err.message}`);
  process.exit(1);
});

module.exports = app;
