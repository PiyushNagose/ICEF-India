const { getRedis } = require("../config/redis");

const normalizeProjectCode = (projectCode = "PROJ26") =>
  String(projectCode || "PROJ26")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "PROJ26";

/**
 * Generate a unique registration number using a Redis atomic counter.
 * Format: {ProjectCode}{6-digit-sequence}, e.g. BPOL26000001.
 */
const generateRegistrationNumber = async (projectCode = "PROJ26") => {
  const code = normalizeProjectCode(projectCode);
  const redis = getRedis();

  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Redis is required for production registration numbers");
    }

    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const fallback = `${code}DEV${Date.now().toString().slice(-6)}${random}`;
    console.warn(`[RegNum] Redis unavailable; using development fallback ${fallback}`);
    return fallback;
  }

  const key = `reg_counter:${code}`;
  const sequence = await redis.incr(key);
  await redis.expire(key, 365 * 24 * 60 * 60);

  return `${code}${String(sequence).padStart(6, "0")}`;
};

/**
 * Build a compact project code from project name + year.
 * Example: "Bihar Police Constable 2026" -> "BPC26".
 */
const buildProjectCode = (projectName = "Project", year) => {
  const words = String(projectName).trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 4)
    .map((word) => word[0].toUpperCase())
    .join("");
  const yr = String(year || new Date().getFullYear()).slice(-2);
  return normalizeProjectCode(`${letters || "PROJ"}${yr}`);
};

module.exports = { generateRegistrationNumber, buildProjectCode };