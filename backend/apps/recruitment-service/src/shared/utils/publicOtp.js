const { StatusCodes } = require("http-status-codes");
const { getRedis } = require("../config/redis");
const ApiError = require("./ApiError");

const normalizeOtpIdentifier = (identifier, type = "email") => {
  const value = String(identifier || "").trim();
  if (type === "email") return value.toLowerCase();
  if (type === "mobile") {
    const digits = value.replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits;
  }
  return value;
};

const allowDevOtpBypass = () => process.env.PUBLIC_OTP_DEV_BYPASS === "true";

const getOtpRedis = () => {
  const redis = getRedis();
  if (!redis && allowDevOtpBypass()) return null;
  if (!redis) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, "OTP service unavailable");
  }
  return redis;
};

const isOTPVerified = async (identifier, type = "mobile") => {
  const normalized = normalizeOtpIdentifier(identifier, type);
  const redis = getRedis();
  if (!redis) return allowDevOtpBypass();
  const value = await redis.get(`otp_verified:${type}:${normalized}`);
  return value === "1";
};

const verifyOTPAndMarkVerified = async (identifier, type, otp) => {
  const normalized = normalizeOtpIdentifier(identifier, type);
  const redis = getOtpRedis();
  if (!redis) return true;

  const key = `otp:${type}:${normalized}`;
  const stored = await redis.get(key);
  if (!stored || stored !== String(otp || "").trim()) return false;

  await redis.del(key);
  await redis.setex(`otp_verified:${type}:${normalized}`, 30 * 60, "1");
  return true;
};

const assertOTPVerified = async (identifier, type = "mobile") => {
  const verified = await isOTPVerified(identifier, type);
  if (!verified) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      `${type === "email" ? "Email" : "Mobile"} OTP not verified. Please verify first.`,
    );
  }
};

module.exports = {
  normalizeOtpIdentifier,
  isOTPVerified,
  verifyOTPAndMarkVerified,
  assertOTPVerified,
};