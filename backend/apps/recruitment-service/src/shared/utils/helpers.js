const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const env = require("../config/env");

/**
 * Generate a unique application ID like BR-2024-XXXXX
 */
const generateApplicationId = () => {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `BR-${year}-${timestamp}${random}`;
};

/**
 * Generate a unique employee ID like EMP-2024-XXXX
 */
const generateEmployeeId = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `EMP-${year}-${random}`;
};

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate a UUID
 */
const generateUUID = () => uuidv4();

const getEncryptionKey = () => {
  if (!env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY is required");
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
};

/**
 * Encrypt sensitive data (e.g. payment gateway API keys)
 */
const encrypt = (text) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `gcm:${iv.toString("hex")}:${tag}:${encrypted}`;
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedText) => {
  const key = getEncryptionKey();
  const parts = String(encryptedText || "").split(":");
  if (parts[0] === "gcm") {
    const [, ivHex, tagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  if (parts.length !== 2) throw new Error("Invalid encrypted payload");
  const [ivHex, encrypted] = parts;
  const legacyKey = Buffer.from(env.ENCRYPTION_KEY, "utf8").slice(0, 32);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", legacyKey, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

/**
 * Calculate application fee based on candidate category.
 * feeConfig: { general, scSt, obc, ews, pwd }
 * Real-world: SC/ST/PwD get reduced/free, OBC/EWS pay general or reduced, General pays full.
 */
const calculateFee = (feeConfig, category) => {
  if (!feeConfig) return 0;
  const cat = (category || "").toLowerCase();
  if (cat === "sc" || cat === "st")
    return feeConfig.scSt ?? feeConfig.scst ?? 0;
  if (cat === "pwd") return feeConfig.pwd ?? 0;
  if (cat === "obc") return feeConfig.obc ?? feeConfig.general ?? 0;
  if (cat === "ews") return feeConfig.ews ?? feeConfig.general ?? 0;
  return feeConfig.general ?? 0;
};

/**
 * Sanitize pagination params from query string
 */
const getPaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  generateApplicationId,
  generateEmployeeId,
  generateOTP,
  generateUUID,
  encrypt,
  decrypt,
  calculateFee,
  getPaginationParams,
};
