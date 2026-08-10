const { getRedis } = require("../config/redis");
const logger = require("./logger");

const PUBLIC_CACHE_PATTERNS = ["public:v*:projects:*", "public:v*:project:*"];

const deleteByPattern = async (redis, pattern) => {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length) await redis.del(keys);
  } while (cursor !== "0");
};

const invalidatePublicRecruitmentCache = async () => {
  const redis = getRedis();
  if (!redis) return;

  try {
    await Promise.all(
      PUBLIC_CACHE_PATTERNS.map((pattern) => deleteByPattern(redis, pattern)),
    );
  } catch (error) {
    logger.warn(`Public cache invalidation skipped: ${error.message}`);
  }
};

module.exports = { invalidatePublicRecruitmentCache };
