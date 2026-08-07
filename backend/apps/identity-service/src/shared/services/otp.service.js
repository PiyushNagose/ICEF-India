const { getRedis } = require("../config/redis");
const crypto = require("crypto");

const normalizeIdentifier = (identifier, type = "email") => {
  const value = String(identifier || "").trim();
  if (type === "email") return value.toLowerCase();
  if (type === "mobile") {
    const digits = value.replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  }
  return value;
};

class OTPService {
  /**
   * Generate a 6-digit OTP
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store OTP in Redis with expiry
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @returns {Promise<string>} Generated OTP
   */
  async createOTP(identifier, type = "email") {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      const otp = this.generateOTP();

      if (!redis) {
        // If Redis not available, store in memory (NOT RECOMMENDED FOR PRODUCTION)
        console.warn("Redis not available. OTP will not persist.");
        return otp;
      }

      const redisKey = `otp:${type}:${identifier}`;

      // Store OTP with 5-minute expiry
      await redis.setex(redisKey, 5 * 60, otp);

      // Track attempts
      const attemptsKey = `otp_attempts:${type}:${identifier}`;
      await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, 15 * 60); // 15 minutes expiry for attempts

      console.log(`OTP generated for ${identifier} (expires in 5 min)`);

      return otp;
    } catch (error) {
      console.error("Error creating OTP:", error);
      throw new Error("Failed to generate OTP");
    }
  }

  /**
   * Verify OTP
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @param {string} otp - OTP to verify
   * @returns {Promise<boolean>} True if OTP is valid
   */
  async verifyOTP(identifier, type, otp) {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      if (!redis) {
        console.warn("Redis not available. Cannot verify OTP.");
        return false;
      }

      const redisKey = `otp:${type}:${identifier}`;
      const storedOTP = await redis.get(redisKey);

      if (!storedOTP) {
        console.log(`OTP expired or not found for ${identifier}`);
        return false;
      }

      if (storedOTP === otp) {
        // OTP is correct, delete it
        await redis.del(redisKey);

        // Mark as verified
        const verifiedKey = `otp_verified:${type}:${identifier}`;
        await redis.setex(verifiedKey, 30 * 60, "1"); // 30 minutes validity

        console.log(`OTP verified successfully for ${identifier}`);
        return true;
      }

      console.log(`Invalid OTP for ${identifier}`);
      return false;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return false;
    }
  }

  /**
   * Check if identifier is verified
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @returns {Promise<boolean>} True if verified
   */
  async isVerified(identifier, type) {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      if (!redis) return false;

      const verifiedKey = `otp_verified:${type}:${identifier}`;
      const verified = await redis.get(verifiedKey);
      return verified === "1";
    } catch (error) {
      console.error("Error checking verification:", error);
      return false;
    }
  }

  /**
   * Check OTP request attempts (rate limiting)
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @returns {Promise<number>} Number of attempts in last 15 minutes
   */
  async getAttempts(identifier, type) {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      if (!redis) return 0;

      const attemptsKey = `otp_attempts:${type}:${identifier}`;
      const attempts = await redis.get(attemptsKey);
      return parseInt(attempts) || 0;
    } catch (error) {
      console.error("Error getting attempts:", error);
      return 0;
    }
  }

  /**
   * Check if rate limit exceeded
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @param {number} maxAttempts - Maximum attempts allowed (default: 3)
   * @returns {Promise<boolean>} True if rate limit exceeded
   */
  async isRateLimited(identifier, type, maxAttempts = 3) {
    const attempts = await this.getAttempts(identifier, type);
    return attempts >= maxAttempts;
  }

  /**
   * Get remaining time for OTP
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   * @returns {Promise<number>} Remaining seconds (-1 if not found)
   */
  async getRemainingTime(identifier, type) {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      if (!redis) return -1;

      const redisKey = `otp:${type}:${identifier}`;
      const ttl = await redis.ttl(redisKey);
      return ttl > 0 ? ttl : -1;
    } catch (error) {
      console.error("Error getting TTL:", error);
      return -1;
    }
  }

  /**
   * Clear OTP (for testing or manual reset)
   * @param {string} identifier - Email or mobile number
   * @param {string} type - "email" or "mobile"
   */
  async clearOTP(identifier, type) {
    identifier = normalizeIdentifier(identifier, type);
    const redis = getRedis();

    try {
      if (!redis) return;

      const redisKey = `otp:${type}:${identifier}`;
      const attemptsKey = `otp_attempts:${type}:${identifier}`;
      const verifiedKey = `otp_verified:${type}:${identifier}`;

      await redis.del(redisKey);
      await redis.del(attemptsKey);
      await redis.del(verifiedKey);

      console.log(`OTP cleared for ${identifier}`);
    } catch (error) {
      console.error("Error clearing OTP:", error);
    }
  }
}

module.exports = new OTPService();
