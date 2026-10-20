import { Queue } from "bullmq";
import { env } from "../config/env.js";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export const reservationExpiryQueue = new Queue(
  "fair-drop-reservation-expiry",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: "exponential",
        delay: 2000,
      },

      removeOnComplete: {
        age: 3600,
        count: 100,
      },

      removeOnFail: {
        age: 86400,
        count: 100,
      },
    },
  }
);