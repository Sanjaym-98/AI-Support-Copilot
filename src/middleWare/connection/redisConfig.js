const IORedis = require("ioredis");

let connection;

if (process.env.REDIS_URL) {
  // Production - use REDIS_URL
  connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {
      rejectUnauthorized: false
    }
  });
  console.log("✅ Redis connected via REDIS_URL");
} else {
  // Local development
  connection = new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null
  });
  console.log("⚠️ Redis connected to localhost (fallback)");
}

module.exports = connection;

module.exports = connection;