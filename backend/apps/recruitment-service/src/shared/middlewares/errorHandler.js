const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const env = require("../config/env");
const { notifyAdmins } = require("../utils/notifyAdmins");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || "record";
    if (field === "publicSlug") {
      message =
        "A project with this name already exists. Please choose a different project name.";
    } else if (field === "postCode") {
      message =
        "Advertisement / Exam Code already exists. Please choose a different code.";
    } else {
      message = `${field} already exists`;
    }
    errors = [{ field, message }];
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    const field = err.path === "_id" ? "record" : err.path;
    message = `Please select a valid ${field}.`;
    errors = [{ field, message }];
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${message}`, {
      stack: err.stack,
    });
    if (/upload|payment|admit-card|bulk|allocation/i.test(req.path)) {
      notifyAdmins({
        type: "system_audit",
        title: "Operational API failure",
        message: `${req.method} ${req.path} failed: ${message}`,
        link: req.path.startsWith("/api/admin") ? req.path.replace(/^\/api/, "") : "/admin/dashboard",
        metadata: {
          path: req.path,
          method: req.method,
          statusCode: String(statusCode),
          userId: req.user?.id?.toString?.() || "",
        },
      }).catch(() => {});
    }
  }

  const response = {
    success: false,
    statusCode,
    message,
    ...(errors.length > 0 && { errors }),
    ...(env.isDevelopment && statusCode >= 500 && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
