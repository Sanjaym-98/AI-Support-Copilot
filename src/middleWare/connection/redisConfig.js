const IORedis = require("ioredis");

let connection;

if (process.env.REDIS_URL) {
  // Production (Render) - use REDIS_URL
  connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {
      rejectUnauthorized: false // Required for Upstash (cloud Redis)
    }
  });
} else {
  // Local development
  connection = new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null
  });
}

module.exports = connection;