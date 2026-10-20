import mongoose from "mongoose";

import Reservation from "../models/Reservation.js";
import Ticket from "../models/Ticket.js";
import {
    reservationIdempotencyKey,
    getIdempotentResponse,
    saveIdempotentResponse
} from "../services/reservation-idempotency.service.js";

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
        // Idempotency key (replay the saved response on retry)
        // --------------------------------------------------------

        const redisKey = reservationIdempotencyKey(
            req.user.id,
            reservationId,
            idempotencyKey
        );

        const cachedResponse = await getIdempotentResponse(redisKey);

        if (cachedResponse) {
            return res.status(200).json(JSON.parse(cachedResponse));
        }

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

        try {
            await saveIdempotentResponse(
                redisKey,
                responsePayload
            );
        } catch (cacheError) {
            // The ticket is already SOLD. A cache failure must not turn
            // a successful confirmation into an error response.
            console.error("Idempotency save error:", cacheError);
        }

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