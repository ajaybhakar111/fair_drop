import mongoose from "mongoose";
import Event from "../models/Event.js";
import Drop from "../models/Drop.js";
import Ticket from "../models/Ticket.js";

// Number of generated tickets per event (used by the admin UI)
async function getTicketCounts(eventIds) {
  if (eventIds.length === 0) return new Map();

  const rows = await Ticket.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    { $group: { _id: "$eventId", count: { $sum: 1 } } }
  ]);

  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// ============================================================
// CREATE EVENT
// POST /api/v1/events
// ============================================================

export async function createEvent(req, res, next) {
  try {
    const {
      name,
      description,
      imageUrl,
      venue,
      date,
      startTime,
      totalTickets
    } = req.body;

    // Basic validation
    if (
      !name ||
      !venue ||
      !date ||
      !startTime ||
      !totalTickets
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "name, venue, date, startTime and totalTickets are required"
        }
      });
    }

    // Validate ticket count
    if (!Number.isInteger(totalTickets) || totalTickets < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "totalTickets must be an integer greater than 0"
        }
      });
    }

    const event = await Event.create({
      name,
      description: description || "",
      imageUrl: imageUrl || "",
      venue,
      date,
      startTime,
      totalTickets,
      status: "DRAFT"
    });

    return res.status(201).json({
      success: true,
      data: {
        event: { ...event.toObject(), ticketsGenerated: 0 }
      },
      message: "Event created successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET ALL EVENTS
// GET /api/v1/events?page=1&limit=20&status=ACTIVE
// ============================================================

export async function getEvents(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        "DRAFT",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED"
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid event status"
          }
        });
      }

      filter.status = req.query.status;
    } else if (req.query.includeDrafts !== "true") {
      // Fans never see DRAFT events. The admin panel passes includeDrafts=true.
      filter.status = { $ne: "DRAFT" };
    }

    const [rawEvents, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Event.countDocuments(filter)
    ]);

    const ticketCounts = await getTicketCounts(
      rawEvents.map((e) => e._id)
    );

    const events = rawEvents.map((e) => ({
      ...e,
      ticketsGenerated: ticketCounts.get(String(e._id)) || 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      message: "Events fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET SINGLE EVENT
// GET /api/v1/events/:eventId
// ============================================================

export async function getEvent(req, res, next) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid event ID"
        }
      });
    }

    const event = await Event.findById(eventId).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found"
        }
      });
    }

    // The fan event page shows the event together with its drop.
    // Prefer a live drop; fall back to a cancelled one so the page can say so.
    const drop =
      (await Drop.findOne({
        eventId,
        status: { $ne: "CANCELLED" }
      })
        .sort({ createdAt: -1 })
        .lean()) ||
      (await Drop.findOne({ eventId })
        .sort({ createdAt: -1 })
        .lean());

    const ticketsGenerated = await Ticket.countDocuments({ eventId });

    return res.status(200).json({
      success: true,
      data: {
        event: { ...event, ticketsGenerated },
        drop: drop || null
      },
      message: "Event fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// UPDATE EVENT
// PATCH /api/v1/events/:eventId
// ============================================================

export async function updateEvent(req, res, next) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid event ID"
        }
      });
    }

    const allowedFields = [
      "name",
      "description",
      "imageUrl",
      "venue",
      "date",
      "startTime",
      "totalTickets",
      "status"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid fields provided for update"
        }
      });
    }

    if (
      updates.totalTickets !== undefined &&
      (!Number.isInteger(updates.totalTickets) ||
        updates.totalTickets < 1)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "totalTickets must be an integer greater than 0"
        }
      });
    }

    const event = await Event.findByIdAndUpdate(
      eventId,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        event
      },
      message: "Event updated successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// DELETE EVENT
// DELETE /api/v1/events/:eventId
// ============================================================

export async function deleteEvent(req, res, next) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid event ID"
        }
      });
    }

    const event = await Event.findByIdAndDelete(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        eventId: event._id
      },
      message: "Event deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}