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
const { connectRabbitMQ } = require("./src/shared/config/rabbitmq");
const { connectCloudinary } = require("./src/shared/config/cloudinary");
const { initSocket } = require("./src/shared/socket/index");
const env = require("./src/shared/config/env");
const logger = require("./src/shared/utils/logger");
const errorHandler = require("./src/shared/middlewares/errorHandler");
const notFound = require("./src/shared/middlewares/notFound");
const { apiLimiter } = require("./src/shared/middlewares/rateLimiter");

// ── Service-local routes ──────────────────────────────────────
const adminPaymentRoutes = require("./src/routes/admin/payment.routes");
const adminSupportRoutes = require("./src/routes/admin/support.routes");
const candidateNotificationRoutes = require("./src/routes/candidate/notification.routes");
const candidateSupportRoutes = require("./src/routes/candidate/support.routes");
const candidatePaymentRoutes = require("./src/routes/candidate/payment.routes");

const PORT = parseInt(process.env.COMMUNICATION_SERVICE_PORT, 10) || 5003;
const parsedOrigins =
  env.CLIENT_URL?.split(",")
    .map((origin) => origin.trim())
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
app.use(cookieParser());
app.use("/api/candidate/payments", apiLimiter, candidatePaymentRoutes);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Swagger Documentation ─────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api/admin", adminPaymentRoutes); // /payments + /payment-gateways
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/candidate/notifications", candidateNotificationRoutes);
app.use("/api/candidate/support", candidateSupportRoutes);

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "Communication & Payment Service",
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
  await connectRabbitMQ();

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
    logger.info(`💬 Communication & Payment Service running on port ${PORT}`);
    console.log(`💬 Communication & Payment Service: http://localhost:${PORT}`);
    console.log(`   Swagger: http://localhost:${PORT}/api/docs`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down Communication Service.`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((err) => {
  logger.error(`Failed to start Communication Service: ${err.message}`);
  process.exit(1);
});

module.exports = app;
