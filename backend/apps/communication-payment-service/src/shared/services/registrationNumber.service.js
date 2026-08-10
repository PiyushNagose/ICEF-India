const { getRedis } = require("../config/redis");
const Application = require("../models/Application");

const normalizeProjectCode = (projectCode = "APP26") =>
  String(projectCode || "APP26")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "APP26";

const generateRegistrationNumber = async (projectCode = "APP26") => {
  const code = normalizeProjectCode(projectCode);
  const redis = getRedis();

  if (!redis) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingCount = await Application.countDocuments({
      registrationNumber: new RegExp(`^${escapedCode}\\d{6}$`),
    });

    for (let offset = 1; offset <= 25; offset += 1) {
      const sequence = existingCount + offset;
      const candidate = `${code}${String(sequence).padStart(6, "0")}`;
      const exists = await Application.exists({ registrationNumber: candidate });
      if (!exists) return candidate;
    }

    throw new Error("Unable to generate registration number");
  }

  const key = `reg_counter:${code}`;
  const sequence = await redis.incr(key);
  await redis.expire(key, 365 * 24 * 60 * 60);

  return `${code}${String(sequence).padStart(6, "0")}`;
};

const buildProjectCode = (projectName = "Project", year) => {
  const words = String(projectName).trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 4)
    .map((word) => word[0].toUpperCase())
    .join("");
  const yr = String(year || new Date().getFullYear()).slice(-2);
  return normalizeProjectCode(`${letters || "APP"}${yr}`);
};

module.exports = { generateRegistrationNumber, buildProjectCode };
