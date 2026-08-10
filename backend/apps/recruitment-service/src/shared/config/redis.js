const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

let redisClient = null;

const connectRedis = () => {
  const redisUrl = env.REDIS_URL;
  const isLocalRedis =
    !redisUrl || redisUrl.includes("localhost") || redisUrl.includes("127.0.0.1");

  if (env.isProduction && isLocalRedis) {
    logger.warn("Redis URL not configured for production. Continuing without Redis.");
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn("⚠️  Redis not available. Continuing without caching.");
          return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: false,
      connectTimeout: 5000,
    });

    redisClient.on("connect", () => {
      logger.info("📦 Redis connected");
    });

    redisClient.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        logger.warn("⚠️  Redis not running. Caching disabled.");
      } else {
        logger.error(`Redis error: ${err.message}`);
      }
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    logger.warn(`⚠️  Redis connection failed: ${error.message}`);
    logger.warn("Continuing without Redis — caching disabled");
    return null;
  }
};

const getRedis = () => {
  if (!redisClient || redisClient.status !== "ready") {
    logger.warn("Redis not available. Operation skipped.");
    return null;
  }
  return redisClient;
};

module.exports = { connectRedis, getRedis };
