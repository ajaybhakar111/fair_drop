import mongoose from "mongoose";
import { Worker } from "bullmq";
import { reservationExpiryQueue } from "../queues/reservation-expiry.queue.js";
import { env } from "../config/env.js";
import { connectMongoDB } from "../config/mongodb.js";

import Drop from "../models/Drop.js";
import Allocation from "../models/Allocation.js";
import Entry from "../models/Entry.js";
import Ticket from "../models/Ticket.js";
import Reservation from "../models/Reservation.js";

import {
    selectFairEntries
} from "../services/fair-selection.service.js";

import {
    publishAllocationCompleted
} from "../services/drop-events.service.js";

import {
    notifyAllocationSelected,
    notifyAllocationNotSelected,
    notifyReservationCreated
} from "../services/notification.service.js";
// ============================================================
// REDIS / BULLMQ CONNECTION
// ============================================================

const connection = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT
};

// ============================================================
// CONFIG
// ============================================================

const RESERVATION_DURATION_MS = 5 * 60 * 1000;

// ============================================================
// ASSIGN TICKET + CREATE RESERVATION
// ============================================================

async function assignTicketAndCreateReservation({
    entry,
    ticket,
    dropId
}) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // --------------------------------------------------------
        // 1. Atomically reserve ticket
        // --------------------------------------------------------

        const reservedTicket = await Ticket.findOneAndUpdate(
            {
                _id: ticket._id,
                status: "AVAILABLE"
            },
            {
                $set: {
                    status: "RESERVED"
                }
            },
            {
                new: true,
                session
            }
        );

        if (!reservedTicket) {
            throw new Error(
                `Ticket ${ticket._id} is no longer available`
            );
        }

        // --------------------------------------------------------
        // 2. Calculate reservation expiry
        // --------------------------------------------------------

        const expiresAt = new Date(
            Date.now() + RESERVATION_DURATION_MS
        );

        // --------------------------------------------------------
        // 3. Create reservation
        // --------------------------------------------------------

        const reservation = await Reservation.create(
            [
                {
                    userId: entry.userId,
                    dropId,
                    entryId: entry._id,
                    ticketId: reservedTicket._id,
                    status: "ACTIVE",
                    expiresAt
                }
            ],
            {
                session
            }
        );

        // --------------------------------------------------------
        // 4. Commit transaction
        // --------------------------------------------------------
        await session.commitTransaction();

        const createdReservation = reservation[0];

        await reservationExpiryQueue.add(
            "expire-reservation",
            {
                reservationId: createdReservation._id.toString(),
            },
            {
                delay: RESERVATION_DURATION_MS,
                jobId: `reservation-expiry-${createdReservation._id}`,
            }
        );

        console.log(
            `⏰ Expiry job scheduled for reservation ${createdReservation._id}`
        );

        return createdReservation;

    } catch (error) {

        await session.abortTransaction();

        throw error;

    } finally {

        await session.endSession();
    }
}

// ============================================================
// ALLOCATION WORKER
// ============================================================

const allocationWorker = new Worker(
    "fair-drop-allocation",

    async (job) => {

        const {
            dropId,
            allocationId
        } = job.data;

        console.log("");
        console.log("========================================");
        console.log("📥 Allocation job received");
        console.log(`🆔 Job ID: ${job.id}`);
        console.log(`🎯 Drop ID: ${dropId}`);
        console.log(`🧾 Allocation ID: ${allocationId}`);
        console.log("========================================");

        // ========================================================
        // 1. VALIDATE JOB DATA
        // ========================================================

        if (!dropId) {
            throw new Error("dropId is required");
        }

        if (!allocationId) {
            throw new Error("allocationId is required");
        }

        // ========================================================
        // 2. FIND DROP
        // ========================================================

        const drop = await Drop.findById(dropId);

        if (!drop) {
            throw new Error(
                `Drop not found: ${dropId}`
            );
        }

        console.log(
            `📦 Drop found: ${drop.name}`
        );

        console.log(
            `📊 Drop status: ${drop.status}`
        );

        // ========================================================
        // 3. FIND ALLOCATION
        // ========================================================

        // IMPORTANT:
        // allocationId refers to MongoDB _id.
        // DO NOT use { allocationId } here.

        const allocation =
            await Allocation.findById(allocationId);

        if (!allocation) {
            throw new Error(
                `Allocation record not found: ${allocationId}`
            );
        }

        // ========================================================
        // 3A. VERIFY DROP RELATIONSHIP
        // ========================================================

        if (
            allocation.dropId.toString() !==
            dropId.toString()
        ) {
            throw new Error(
                "Allocation does not belong to this drop"
            );
        }

        console.log(
            `📊 Allocation status: ${allocation.status}`
        );

        // ========================================================
        // 4. DUPLICATE / RETRY PROTECTION
        // ========================================================

        if (allocation.status === "COMPLETED") {

            console.log(
                "ℹ️ Allocation already completed"
            );

            return {
                success: true,
                message: "Allocation already completed",
                dropId,
                allocationId:
                    allocation._id.toString()
            };
        }

        // --------------------------------------------------------
        // IMPORTANT
        // Do NOT silently return when PROCESSING.
        //
        // If the previous worker crashed after setting PROCESSING,
        // the allocation could otherwise remain stuck forever.
        // --------------------------------------------------------

        if (allocation.status === "PROCESSING") {

            console.log(
                "⚠️ Allocation is already marked PROCESSING"
            );

            throw new Error(
                "Allocation is already processing"
            );
        }

        // ========================================================
        // 5. MARK ALLOCATION PROCESSING
        // ========================================================

        allocation.status = "PROCESSING";

        allocation.startedAt = new Date();

        allocation.failedAt = null;

        allocation.errorMessage = null;

        await allocation.save();

        console.log(
            "🔄 Allocation marked as PROCESSING"
        );

        // ========================================================
        // 6. GET ELIGIBLE ENTRIES
        // ========================================================

        const eligibleEntries =
            await Entry.find({
                dropId,
                status: "ELIGIBLE"
            })
                .select(
                    "_id userId dropId joinedAt"
                )
                .lean();

        console.log(
            `👥 Eligible entries: ${eligibleEntries.length}`
        );

        // ========================================================
        // 7. GET AVAILABLE TICKETS
        // ========================================================

        const availableTickets =
            await Ticket.find({
                eventId: drop.eventId,
                status: "AVAILABLE"
            })
                .select(
                    "_id ticketNumber"
                )
                .lean();

        console.log(
            `🎟️ Available tickets: ${availableTickets.length}`
        );

        // ========================================================
        // 8. VALIDATE ALLOCATION
        // ========================================================

        if (eligibleEntries.length === 0) {

            throw new Error(
                "No eligible entries available for allocation"
            );
        }

        if (availableTickets.length === 0) {

            throw new Error(
                "No available tickets available for allocation"
            );
        }

        // ========================================================
        // 9. DETERMINE WINNER COUNT
        // ========================================================

        const winnerCount =
            Math.min(
                eligibleEntries.length,
                availableTickets.length
            );

        console.log(
            `🏆 Winners required: ${winnerCount}`
        );

        // ========================================================
        // 10. FAIR DETERMINISTIC SELECTION
        // ========================================================

        const {
            selectedEntries,
            notSelectedEntries
        } = selectFairEntries(
            eligibleEntries,
            winnerCount,
            allocation.allocationSeed
        );

        console.log(
            `🎯 Selected: ${selectedEntries.length}`
        );

        console.log(
            `❌ Not selected: ${notSelectedEntries.length}`
        );

        // ========================================================
        // 11. UPDATE SELECTED ENTRIES
        // ========================================================

        if (selectedEntries.length > 0) {

            await Entry.updateMany(
                {
                    _id: {
                        $in:
                            selectedEntries.map(
                                (entry) =>
                                    entry._id
                            )
                    },

                    status: "ELIGIBLE"
                },
                {
                    $set: {
                        status: "SELECTED"
                    }
                }
            );
        }

        // ========================================================
        // 12. UPDATE NON-SELECTED ENTRIES
        // ========================================================

        if (notSelectedEntries.length > 0) {

            await Entry.updateMany(
                {
                    _id: {
                        $in:
                            notSelectedEntries.map(
                                (entry) =>
                                    entry._id
                            )
                    },

                    status: "ELIGIBLE"
                },
                {
                    $set: {
                        status: "NOT_SELECTED"
                    }
                }
            );
        }
        // ========================================================
        // 12A. CREATE NOT-SELECTED NOTIFICATIONS
        // ========================================================

        for (const entry of notSelectedEntries) {
            await notifyAllocationNotSelected({
                userId: entry.userId,
                dropId
            });
        }

        // ========================================================
        // 13. SAVE ALLOCATION PROGRESS
        // ========================================================

        allocation.totalEntries =
            eligibleEntries.length;

        allocation.totalTickets =
            availableTickets.length;

        allocation.processedCount = 0;

        allocation.selectedCount =
            selectedEntries.length;

        await allocation.save();

        console.log(
            "📊 Allocation progress initialized"
        );

        // ========================================================
        // 14. ASSIGN TICKETS + CREATE RESERVATIONS
        // ========================================================

        const reservations = [];

        console.log(
            "🎟️ Starting ticket assignment..."
        );

        for (
            let i = 0;
            i < selectedEntries.length;
            i++
        ) {

            const entry =
                selectedEntries[i];

            const ticket =
                availableTickets[i];

            try {

                const reservation =
                    await assignTicketAndCreateReservation({
                        entry,
                        ticket,
                        dropId
                    });

                reservations.push(
                    reservation
                );
                // --------------------------------------------------
                // Create notifications
                // --------------------------------------------------

                await notifyAllocationSelected({
                    userId: entry.userId,
                    dropId,
                    reservationId: reservation._id,
                    ticketId: reservation.ticketId
                });

                await notifyReservationCreated({
                    userId: entry.userId,
                    dropId,
                    reservationId: reservation._id,
                    ticketId: reservation.ticketId
                });
                // --------------------------------------------------
                // Update progress
                // --------------------------------------------------

                allocation.processedCount =
                    i + 1;

                await allocation.save();

                console.log(
                    `🎟️ ${i + 1}/${selectedEntries.length}` +
                    ` → Ticket ${ticket.ticketNumber}` +
                    ` → Reservation ${reservation._id}`
                );

            } catch (error) {

                console.error(
                    `❌ Failed to assign ticket for entry ${entry._id}`
                );

                console.error(error);

                throw error;
            }
        }

        // ========================================================
        // 15. MARK ALLOCATION COMPLETED
        // ========================================================

        allocation.status =
            "COMPLETED";

        allocation.completedAt =
            new Date();

        allocation.processedCount =
            selectedEntries.length;

        allocation.selectedCount =
            selectedEntries.length;

        allocation.errorMessage =
            null;

        allocation.failedAt =
            null;

        await allocation.save();

        // ========================================================
        // 16. MARK DROP COMPLETED
        // ========================================================

        drop.status =
            "COMPLETED";

        await drop.save();

        publishAllocationCompleted(dropId, {
            allocationId: allocation._id.toString(),
            status: "COMPLETED",
            totalEntries: eligibleEntries.length,
            totalTickets: availableTickets.length,
            selectedCount: selectedEntries.length,
            notSelectedCount: notSelectedEntries.length,
            reservationCount: reservations.length
        });
        // ========================================================
        // 17. FINAL LOG
        // ========================================================

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "✅ ALLOCATION COMPLETED"
        );

        console.log(
            `👥 Entries: ${eligibleEntries.length}`
        );

        console.log(
            `🏆 Selected: ${selectedEntries.length}`
        );

        console.log(
            `❌ Not selected: ${notSelectedEntries.length}`
        );

        console.log(
            `🎟️ Reservations: ${reservations.length}`
        );

        console.log(
            `🎯 Drop ID: ${dropId}`
        );

        console.log(
            `🧾 Allocation ID: ${allocation._id}`
        );

        console.log(
            "========================================"
        );

        // ========================================================
        // 18. RETURN RESULT
        // ========================================================

        return {

            success: true,

            message:
                "Allocation completed successfully",

            dropId,

            allocationId:
                allocation._id.toString(),

            totalEntries:
                eligibleEntries.length,

            totalTickets:
                availableTickets.length,

            selectedCount:
                selectedEntries.length,

            notSelectedCount:
                notSelectedEntries.length,

            reservationCount:
                reservations.length
        };
    },

    {
        connection,

        concurrency: 1
    }
);

// ============================================================
// WORKER READY
// ============================================================

allocationWorker.on(
    "ready",
    () => {

        console.log(
            "🚀 Allocation worker is ready"
        );

        console.log(
            "📥 Waiting for allocation jobs..."
        );
    }
);

// ============================================================
// JOB ACTIVE
// ============================================================

allocationWorker.on(
    "active",
    (job) => {

        console.log(
            `⚙️ Allocation job started: ${job.id}`
        );
    }
);

// ============================================================
// JOB COMPLETED
// ============================================================

allocationWorker.on(
    "completed",
    (job, result) => {

        console.log(
            `✅ Allocation job completed: ${job.id}`
        );

        console.log(
            "Result:",
            result
        );
    }
);

// ============================================================
// JOB FAILED
// ============================================================

allocationWorker.on(
    "failed",
    async (job, error) => {

        console.error(
            `❌ Allocation job failed: ${job?.id}`
        );

        console.error(error);

        try {

            const allocationId =
                job?.data?.allocationId;

            if (!allocationId) {
                return;
            }

            await Allocation.findByIdAndUpdate(
                allocationId,
                {
                    $set: {
                        status: "FAILED",

                        failedAt:
                            new Date(),

                        errorMessage:
                            error?.message ||
                            "Allocation worker failed"
                    }
                }
            );

            console.log(
                "⚠️ Allocation marked as FAILED"
            );

        } catch (updateError) {

            console.error(
                "❌ Failed to update allocation status:",
                updateError
            );
        }
    }
);

// ============================================================
// WORKER ERROR
// ============================================================

allocationWorker.on(
    "error",
    (error) => {

        console.error(
            "❌ Allocation worker error:",
            error
        );
    }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {

    console.log(
        `\n🛑 ${signal} received`
    );

    try {

        await allocationWorker.close();

        console.log(
            "✅ Allocation worker closed"
        );

        process.exit(0);

    } catch (error) {

        console.error(
            "❌ Worker shutdown error:",
            error
        );

        process.exit(1);
    }
}

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

// ============================================================
// MONGODB CONNECTION
// ============================================================

await connectMongoDB();

console.log(
    "========================================"
);

console.log(
    "🎯 Fair Drop Allocation Worker"
);

console.log(
    "========================================"
);