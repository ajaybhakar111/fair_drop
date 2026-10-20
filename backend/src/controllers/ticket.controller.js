import Reservation from "../models/Reservation.js"
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Ticket from "../models/Ticket.js";

export async function generateTickets(req, res, next) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid event ID",
        },
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found",
        },
      });
    }

    const existingCount = await Ticket.countDocuments({ eventId });

    if (existingCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "TICKETS_ALREADY_GENERATED",
          message: "Tickets have already been generated for this event",
        },
        data: {
          existingTickets: existingCount,
          expectedTickets: event.totalTickets,
        },
      });
    }

    const tickets = [];

    for (let i = 1; i <= event.totalTickets; i++) {
      tickets.push({
        eventId,
        ticketNumber: `TKT-${eventId}-${String(i).padStart(6, "0")}`,
        status: "AVAILABLE",
      });
    }

    const createdTickets = await Ticket.insertMany(tickets, {
      ordered: true,
    });

    return res.status(201).json({
      success: true,
      data: {
        eventId,
        totalTickets: createdTickets.length,
        status: "AVAILABLE",
      },
      message: "Tickets generated successfully",
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET MY TICKETS
// GET /api/v1/tickets/my
// ============================================================

export async function getMyTickets(req, res, next) {
  try {
    console.log("Fetching tickets for user:", req.user.id);
    const userId = req.user.id;

    const reservations = await Reservation.find({
      userId,
      status: {
        $in: ["ACTIVE", "CONFIRMED"]
      }
    })
      .populate({
        path: "ticketId",
        model: Ticket
      })
      .populate({
        path: "dropId"
      })
      .sort({ createdAt: -1 })
      .lean();

    const tickets = reservations
      .filter((reservation) => reservation.ticketId)
      .map((reservation) => ({
        ticketId: reservation.ticketId._id,
        ticketNumber: reservation.ticketId.ticketNumber,
        status: reservation.ticketId.status,

        reservation: {
          reservationId: reservation._id,
          status: reservation.status,
          expiresAt: reservation.expiresAt,
          confirmedAt: reservation.confirmedAt
        },

        drop: reservation.dropId
          ? {
              dropId: reservation.dropId._id,
              name: reservation.dropId.name,
              status: reservation.dropId.status
            }
          : null
      }));

    return res.status(200).json({
      success: true,
      data: {
        tickets
      },
      message: "Tickets fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}


// ============================================================
// GET SINGLE TICKET
// GET /api/v1/tickets/:ticketId
// ============================================================

export async function getTicketById(req, res, next) {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid ticket ID"
        }
      });
    }

    const reservation = await Reservation.findOne({
      ticketId,
      userId
    })
      .populate({
        path: "ticketId",
        model: Ticket
      })
      .populate({
        path: "dropId"
      })
      .lean();

    if (!reservation || !reservation.ticketId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket not found"
        }
      });
    }

    let event = null;

    if (reservation.dropId?.eventId) {
      event = await Event.findById(
        reservation.dropId.eventId
      ).lean();
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket: {
          ticketId: reservation.ticketId._id,
          ticketNumber: reservation.ticketId.ticketNumber,
          status: reservation.ticketId.status,

          reservation: {
            reservationId: reservation._id,
            status: reservation.status,
            expiresAt: reservation.expiresAt,
            confirmedAt: reservation.confirmedAt
          },

          drop: reservation.dropId
            ? {
                dropId: reservation.dropId._id,
                name: reservation.dropId.name,
                status: reservation.dropId.status
              }
            : null,

          event: event
            ? {
                eventId: event._id,
                name: event.name,
                description: event.description,
                imageUrl: event.imageUrl,
                venue: event.venue,
                date: event.date,
                startTime: event.startTime
              }
            : null
        }
      },
      message: "Ticket fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}