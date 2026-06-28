const { Queue } = require("bullmq");
const redisConnection = require('./redisConfig');


const ticketQueue = new Queue(
  "ticket-processing",
  {
    redisConnection
  }
);

module.exports = ticketQueue;