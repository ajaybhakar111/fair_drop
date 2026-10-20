import mongoose from "mongoose";

import Entry from "../models/Entry.js";
import Reservation from "../models/Reservation.js";
import Ticket from "../models/Ticket.js";
import {
    reservationActionIdempotencyKey,
    reservationIdempotencyKey,
    getIdempotentResponse,
    saveIdempotentResponse
} from "../services/reservation-idempotency.service.js";
import { notifyReservationCreated } from "../services/notification.service.js";

async function reassignTicketToNextWinner({ dropId, ticketId, session, excludeUserId, excludeReservationId }) {
    const assignedUserIds = await Reservation.distinct("userId", {
        dropId,
        _id: { $ne: excludeReservationId },
        status: { $in: ["ACTIVE", "CONFIRMED"] }
    }).session(session);

    const nextEntry = await Entry.findOne({
        dropId,
        status: "SELECTED",
        userId: {
            $ne: excludeUserId,
            $nin: assignedUserIds
        }
    })
        .sort({ joinedAt: 1 })
        .session(session);

    if (!nextEntry) {
        return null;
    }

    const nextReservation = await Reservation.create([
        {
            userId: nextEntry.userId,
            dropId,
            entryId: nextEntry._id,
            ticketId,
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        }
    ], { session });

    await Ticket.findByIdAndUpdate(
        ticketId,
        { $set: { status: "RESERVED" } },
        { session, new: true }
    );

    await notifyReservationCreated({
        userId: nextEntry.userId,
        dropId,
        reservationId: nextReservation[0]._id,
        ticketId: nextReservation[0].ticketId
    });

    return nextReservation[0];
}

// ============================================================
// GET RESERVATION
// ============================================================

export async function getReservation(req, res, next) {
    try {
        const { reservationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(reservationId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid reservation ID"
                }
            });
        }

        const reservation = await Reservation.findOne({
            _id: reservationId,
            userId: req.user.id
        })
            .populate("ticketId")
            .populate("dropId");

        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "RESERVATION_NOT_FOUND",
                    message: "Reservation not found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                reservation
            }
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// CONFIRM RESERVATION
// ============================================================

export async function cancelReservation(req, res, next) {
    const session = await mongoose.startSession();

    try {
        const { reservationId } = req.params;
        const idempotencyKey = req.headers["idempotency-key"];

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Idempotency-Key header is required"
                }
            });
        }

        if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid Idempotency-Key"
                }
            });
        }

        if (!mongoose.Types.ObjectId.isValid(reservationId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid reservation ID"
                }
            });
        }

        const redisKey = reservationActionIdempotencyKey(
            req.user.id,
            reservationId,
            "cancel",
            idempotencyKey
        );

        const cached = await getIdempotentResponse(redisKey);
        if (cached) {
            return res.status(200).json(JSON.parse(cached));
        }

        session.startTransaction();

        const reservation = await Reservation.findOne({
            _id: reservationId,
            userId: req.user.id
        }).session(session);

        if (!reservation) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: "RESERVATION_NOT_FOUND",
                    message: "Reservation not found"
                }
            });
        }

        if (reservation.status === "CONFIRMED") {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                error: {
                    code: "RESERVATION_CONFIRMED",
                    message: "This ticket has already been confirmed and cannot be declined"
                }
            });
        }

        if (reservation.status === "EXPIRED") {
            await session.abortTransaction();
            return res.status(410).json({
                success: false,
                error: {
                    code: "RESERVATION_EXPIRED",
                    message: "Reservation has expired"
                }
            });
        }

        if (reservation.status !== "ACTIVE") {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                error: {
                    code: "RESERVATION_NOT_ACTIVE",
                    message: `Reservation is ${reservation.status}`
                }
            });
        }

        const ticket = await Ticket.findOneAndUpdate(
            {
                _id: reservation.ticketId,
                status: { $in: ["RESERVED", "AVAILABLE"] }
            },
            {
                $set: {
                    status: "AVAILABLE"
                }
            },
            {
                new: true,
                session
            }
        );

        if (!ticket) {
            throw new Error("Ticket could not be released back to the pool");
        }

        const nextWinner = await reassignTicketToNextWinner({
            dropId: reservation.dropId,
            ticketId: reservation.ticketId,
            session,
            excludeUserId: reservation.userId,
            excludeReservationId: reservation._id
        });

        reservation.status = "CANCELLED";
        await reservation.save({ session });

        await session.commitTransaction();

        const responsePayload = {
            success: true,
            data: {
                reservationId: reservation._id,
                status: reservation.status,
                ticketId: reservation.ticketId,
                cancelledAt: new Date(),
                reassignedTo: nextWinner ? {
                    reservationId: nextWinner._id,
                    userId: nextWinner.userId,
                    expiresAt: nextWinner.expiresAt
                } : null
            },
            message: nextWinner
                ? "Reservation cancelled and ticket reassigned to the next eligible winner"
                : "Reservation cancelled successfully and ticket returned to the pool"
        };

        await saveIdempotentResponse(redisKey, responsePayload);
        return res.status(200).json(responsePayload);
    } catch (error) {
        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } catch (abortError) {
            console.error("Transaction abort error:", abortError);
        }

        next(error);
    } finally {
        await session.endSession();
    }
}

export async function confirmReservation(req, res, next) {
    const session = await mongoose.startSession();

    try {
        const { reservationId } = req.params;
        const idempotencyKey = req.headers["idempotency-key"];

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Idempotency-Key header is required"
                }
            });
        }

        if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid Idempotency-Key"
                }
            });
        }
        // --------------------------------------------------------
        // Validate reservation ID
        // --------------------------------------------------------

        if (!mongoose.Types.ObjectId.isValid(reservationId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid reservation ID"
                }
            });
        }

        // --------------------------------------------------------
        // Idempotency key
        // --------------------------------------------------------

        

        // --------------------------------------------------------
        // Start transaction
        // --------------------------------------------------------

        session.startTransaction();

        // --------------------------------------------------------
        // Find reservation owned by current user
        // --------------------------------------------------------

        const reservation =
            await Reservation.findOne({
                _id: reservationId,
                userId: req.user.id
            }).session(session);

        if (!reservation) {
            await session.abortTransaction();

            return res.status(404).json({
                success: false,
                error: {
                    code: "RESERVATION_NOT_FOUND",
                    message: "Reservation not found"
                }
            });
        }

        // --------------------------------------------------------
        // Already confirmed
        // --------------------------------------------------------

        if (reservation.status === "CONFIRMED") {
            await session.commitTransaction();

            const ticket =
                await Ticket.findById(
                    reservation.ticketId
                );

            return res.status(200).json({
                success: true,
                message:
                    "Reservation already confirmed",

                data: {
                    reservation,
                    ticket
                }
            });
        }

        // --------------------------------------------------------
        // Already expired
        // --------------------------------------------------------

        if (reservation.status === "EXPIRED") {
            await session.abortTransaction();

            return res.status(410).json({
                success: false,
                error: {
                    code: "RESERVATION_EXPIRED",
                    message:
                        "Reservation has expired"
                }
            });
        }

        // --------------------------------------------------------
        // Invalid reservation state
        // --------------------------------------------------------

        if (reservation.status !== "ACTIVE") {
            await session.abortTransaction();

            return res.status(409).json({
                success: false,
                error: {
                    code: "RESERVATION_NOT_ACTIVE",
                    message:
                        `Reservation is ${reservation.status}`
                }
            });
        }

        // --------------------------------------------------------
        // Check expiration
        // --------------------------------------------------------

        if (
            !reservation.expiresAt ||
            reservation.expiresAt <= new Date()
        ) {
            reservation.status = "EXPIRED";

            await reservation.save({
                session
            });

            await session.commitTransaction();

            return res.status(410).json({
                success: false,
                error: {
                    code: "RESERVATION_EXPIRED",
                    message:
                        "Reservation has expired"
                }
            });
        }

        // --------------------------------------------------------
        // Atomically change ticket:
        //
        // RESERVED → SOLD
        // --------------------------------------------------------

        const ticket =
            await Ticket.findOneAndUpdate(
                {
                    _id: reservation.ticketId,
                    status: "RESERVED"
                },
                {
                    $set: {
                        status: "SOLD"
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!ticket) {
            throw new Error(
                "Reserved ticket is no longer available"
            );
        }

        // --------------------------------------------------------
        // Confirm reservation
        // --------------------------------------------------------

        reservation.status = "CONFIRMED";

        reservation.confirmedAt =
            new Date();

        await reservation.save({
            session
        });

        // --------------------------------------------------------
        // Commit
        // --------------------------------------------------------

        await session.commitTransaction();

        // --------------------------------------------------------
        // Success
        // --------------------------------------------------------

        const responsePayload = {
            success: true,
            data: {
                reservationId: reservation._id,
                status: reservation.status,
                ticketId: reservation.ticketId,
                confirmedAt: reservation.confirmedAt
            },
            message: "Reservation confirmed successfully"
        };

        await saveIdempotentResponse(
            redisKey,
            responsePayload
        );

        return res.status(200).json(responsePayload);
    } catch (error) {

        // --------------------------------------------------------
        // Abort transaction if still active
        // --------------------------------------------------------

        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } catch (abortError) {
            console.error(
                "Transaction abort error:",
                abortError
            );
        }

        next(error);

    } finally {

        await session.endSession();
    }
}