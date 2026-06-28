const IORedis = require("ioredis");

const connection = new IORedis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null
});

module.exports = connection;