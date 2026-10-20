import { Worker } from "bullmq";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import Reservation from "../models/Reservation.js";
import Ticket from "../models/Ticket.js";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const worker = new Worker(
  "fair-drop-reservation-expiry",
  async (job) => {
    const { reservationId } = job.data;

    console.log(
      `⏳ Processing reservation expiry: ${reservationId}`
    );

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const reservation = await Reservation.findById(
        reservationId
      ).session(session);

      if (!reservation) {
        throw new Error("Reservation not found");
      }

      // Already handled
      if (reservation.status !== "ACTIVE") {
        await session.commitTransaction();

        console.log(
          `ℹ️ Reservation already ${reservation.status}`
        );

        return;
      }

      // Not actually expired yet
      if (reservation.expiresAt > new Date()) {
        await session.commitTransaction();

        console.log(
          `ℹ️ Reservation ${reservationId} has not expired yet`
        );

        return;
      }

      // Release ticket
      const ticket = await Ticket.findOneAndUpdate(
        {
          _id: reservation.ticketId,
          status: "RESERVED",
        },
        {
          $set: {
            status: "AVAILABLE",
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!ticket) {
        throw new Error(
          "Reserved ticket could not be released"
        );
      }

      // Expire reservation
      reservation.status = "EXPIRED";

      await reservation.save({
        session,
      });

      await session.commitTransaction();

      console.log(
        `✅ Reservation expired: ${reservationId}`
      );

      console.log(
        `🎟️ Ticket released: ${ticket.ticketNumber}`
      );

    } catch (error) {
      await session.abortTransaction();

      console.error(
        `❌ Reservation expiry failed:`,
        error
      );

      throw error;

    } finally {
      await session.endSession();
    }
  },
  {
    connection,
    concurrency: 10,
  }
);

worker.on("completed", (job) => {
  console.log(
    `✅ Expiry job completed: ${job.id}`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `❌ Expiry job failed: ${job?.id}`,
    error
  );
});

worker.on("ready", () => {
  console.log("🟢 Reservation expiry worker is ready");
});

worker.on("error", (error) => {
  console.error("🔴 Reservation expiry worker error:", error);
});

console.log("🚀 Reservation expiry worker started");
console.log("📡 Queue: fair-drop-reservation-expiry");