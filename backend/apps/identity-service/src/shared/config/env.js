require("dotenv").config({
  path: require("path").join(__dirname, "../../../../.env"),
});

const envName = process.env.NODE_ENV || "development";

const requireProductionValue = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (envName === "production" && !process.env[name]) {
    throw new Error(`${name} is required in production.`);
  }
  return value;
};

const env = {
  NODE_ENV: envName,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  // MongoDB
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/recruitment_portal",

  // JWT
  JWT_ACCESS_SECRET: requireProductionValue(
    "JWT_ACCESS_SECRET",
    "dev_access_secret_change_in_prod",
  ),
  JWT_REFRESH_SECRET: requireProductionValue(
    "JWT_REFRESH_SECRET",
    "dev_refresh_secret_change_in_prod",
  ),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  WEBHOOK_BASE_URL: requireProductionValue(
    "WEBHOOK_BASE_URL",
    process.env.CLIENT_URL || "http://localhost:5173",
  ),

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://localhost:5672",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@recruitment.gov.in",
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || "Recruitment Portal",

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX:
    parseInt(process.env.RATE_LIMIT_MAX, 10) ||
    (envName === "production" ? 100 : 1000),
  PUBLIC_OTP_IP_WINDOW_MS:
    parseInt(process.env.PUBLIC_OTP_IP_WINDOW_MS, 10) || 15 * 60 * 1000,
  PUBLIC_OTP_IP_MAX:
    parseInt(process.env.PUBLIC_OTP_IP_MAX, 10) ||
    (envName === "production" ? 60 : 300),
  PUBLIC_OTP_IDENTIFIER_MAX:
    parseInt(process.env.PUBLIC_OTP_IDENTIFIER_MAX, 10) ||
    (envName === "production" ? 10 : 100),
  PUBLIC_OTP_ATTEMPT_WINDOW_SECONDS:
    parseInt(process.env.PUBLIC_OTP_ATTEMPT_WINDOW_SECONDS, 10) || 15 * 60,

  // Encryption
  ENCRYPTION_KEY: requireProductionValue(
    "ENCRYPTION_KEY",
    "dev_encryption_key_change_in_prod_32b",
  ),

  get isProduction() {
    return this.NODE_ENV === "production";
  },
  get isDevelopment() {
    return this.NODE_ENV === "development";
  },
};

module.exports = env;
