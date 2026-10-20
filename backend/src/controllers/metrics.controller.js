import mongoose from "mongoose";

import User from "../models/User.js";
import Event from "../models/Event.js";
import Drop from "../models/Drop.js";
import Entry from "../models/Entry.js";
import Ticket from "../models/Ticket.js";
import Reservation from "../models/Reservation.js";
import Allocation from "../models/Allocation.js";
import Notification from "../models/Notification.js";

import { redisClient } from "../config/redis.js";
import { allocationQueue } from "../queues/allocation.queue.js";
import { reservationExpiryQueue } from "../queues/reservation-expiry.queue.js";


// ============================================================
// OVERVIEW
// GET /api/v1/admin/metrics/overview
// ============================================================

export async function getOverviewMetrics(req, res, next) {
  try {
    const [
      totalUsers,
      totalEvents,
      totalDrops,
      totalEntries,
      eligibleEntries,
      selectedEntries,
      notSelectedEntries,
      totalTickets,
      availableTickets,
      reservedTickets,
      soldTickets,
      activeReservations,
      confirmedReservations,
      expiredReservations,
      notifications
    ] = await Promise.all([
      User.countDocuments(),

      Event.countDocuments(),

      Drop.countDocuments(),

      Entry.countDocuments(),

      Entry.countDocuments({
        status: "ELIGIBLE"
      }),

      Entry.countDocuments({
        status: "SELECTED"
      }),

      Entry.countDocuments({
        status: "NOT_SELECTED"
      }),

      Ticket.countDocuments(),

      Ticket.countDocuments({
        status: "AVAILABLE"
      }),

      Ticket.countDocuments({
        status: "RESERVED"
      }),

      Ticket.countDocuments({
        status: "SOLD"
      }),

      Reservation.countDocuments({
        status: "ACTIVE"
      }),

      Reservation.countDocuments({
        status: "CONFIRMED"
      }),

      Reservation.countDocuments({
        status: "EXPIRED"
      }),

      Notification.countDocuments()
    ]);


    const [
      scheduledDrops,
      openDrops,
      closedDrops,
      allocatingDrops,
      completedDrops,
      cancelledDrops
    ] = await Promise.all([
      Drop.countDocuments({ status: "SCHEDULED" }),
      Drop.countDocuments({ status: "OPEN" }),
      Drop.countDocuments({ status: "CLOSED" }),
      Drop.countDocuments({ status: "ALLOCATING" }),
      Drop.countDocuments({ status: "COMPLETED" }),
      Drop.countDocuments({ status: "CANCELLED" })
    ]);


    return res.status(200).json({
      success: true,

      data: {
        users: {
          total: totalUsers
        },

        events: {
          total: totalEvents
        },

        drops: {
          total: totalDrops,
          scheduled: scheduledDrops,
          open: openDrops,
          closed: closedDrops,
          allocating: allocatingDrops,
          completed: completedDrops,
          cancelled: cancelledDrops
        },

        entries: {
          total: totalEntries,
          eligible: eligibleEntries,
          selected: selectedEntries,
          notSelected: notSelectedEntries
        },

        tickets: {
          total: totalTickets,
          available: availableTickets,
          reserved: reservedTickets,
          sold: soldTickets
        },

        reservations: {
          active: activeReservations,
          confirmed: confirmedReservations,
          expired: expiredReservations
        },

        notifications: {
          total: notifications
        }
      },

      message: "Overview metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}


// ============================================================
// DROP METRICS
// GET /api/v1/admin/metrics/drops/:dropId
// ============================================================

export async function getDropMetrics(req, res, next) {
  try {
    const { dropId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }


    const drop = await Drop.findById(dropId)
      .populate("eventId", "name venue date startTime totalTickets status")
      .lean();


    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }


    const [
      totalEntries,
      eligibleEntries,
      selectedEntries,
      notSelectedEntries,
      totalReservations,
      activeReservations,
      confirmedReservations,
      expiredReservations,
      allocation
    ] = await Promise.all([
      Entry.countDocuments({
        dropId
      }),

      Entry.countDocuments({
        dropId,
        status: "ELIGIBLE"
      }),

      Entry.countDocuments({
        dropId,
        status: "SELECTED"
      }),

      Entry.countDocuments({
        dropId,
        status: "NOT_SELECTED"
      }),

      Reservation.countDocuments({
        dropId
      }),

      Reservation.countDocuments({
        dropId,
        status: "ACTIVE"
      }),

      Reservation.countDocuments({
        dropId,
        status: "CONFIRMED"
      }),

      Reservation.countDocuments({
        dropId,
        status: "EXPIRED"
      }),

      Allocation.findOne({
        dropId
      }).lean()
    ]);


    const ticketStats = await Ticket.aggregate([
      {
        $match: {
          eventId: drop.eventId._id
        }
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1
          }
        }
      }
    ]);


    const tickets = {
      available: 0,
      reserved: 0,
      sold: 0
    };


    for (const item of ticketStats) {
      const key = item._id.toLowerCase();

      if (key in tickets) {
        tickets[key] = item.count;
      }
    }


    const selectionRate =
      totalEntries > 0
        ? Number(((selectedEntries / totalEntries) * 100).toFixed(2))
        : 0;


    const confirmationRate =
      selectedEntries > 0
        ? Number(((confirmedReservations / selectedEntries) * 100).toFixed(2))
        : 0;


    return res.status(200).json({
      success: true,

      data: {
        drop,

        entries: {
          total: totalEntries,
          eligible: eligibleEntries,
          selected: selectedEntries,
          notSelected: notSelectedEntries
        },

        selection: {
          selectionRate
        },

        tickets,

        reservations: {
          total: totalReservations,
          active: activeReservations,
          confirmed: confirmedReservations,
          expired: expiredReservations
        },

        confirmation: {
          confirmationRate
        },

        allocation: allocation || null
      },

      message: "Drop metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}


// ============================================================
// TRAFFIC METRICS
// GET /api/v1/admin/metrics/traffic
// ============================================================

export async function getTrafficMetrics(req, res, next) {
  try {
    const keys = await redisClient.keys("fairdrop:rate:*");

    const rateLimits = [];

    for (const key of keys) {
      const value = await redisClient.get(key);

      rateLimits.push({
        key,
        value: value ? Number(value) : 0
      });
    }


    return res.status(200).json({
      success: true,

      data: {
        rateLimitKeys: rateLimits.length,

        rateLimits,

        timestamp: new Date().toISOString()
      },

      message: "Traffic metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}


// ============================================================
// ABUSE METRICS
// GET /api/v1/admin/metrics/abuse
// ============================================================

export async function getAbuseMetrics(req, res, next) {
  try {
    const keys = await redisClient.keys("fairdrop:abuse:*");

    const abuseCounters = [];

    for (const key of keys) {
      const value = await redisClient.get(key);

      abuseCounters.push({
        key,
        count: value ? Number(value) : 0
      });
    }


    const totalAbuseEvents = abuseCounters.reduce(
      (sum, item) => sum + item.count,
      0
    );


    return res.status(200).json({
      success: true,

      data: {
        totalAbuseEvents,

        activeAbuseCounters: abuseCounters.length,

        abuseCounters,

        timestamp: new Date().toISOString()
      },

      message: "Abuse metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}


// ============================================================
// QUEUE METRICS
// GET /api/v1/admin/metrics/queues
// ============================================================

export async function getQueueMetrics(req, res, next) {
  try {
    const [
      allocationCounts,
      reservationExpiryCounts
    ] = await Promise.all([
      allocationQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed"
      ),

      reservationExpiryQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed"
      )
    ]);


    return res.status(200).json({
      success: true,

      data: {
        allocation: allocationCounts,

        reservationExpiry: reservationExpiryCounts,

        timestamp: new Date().toISOString()
      },

      message: "Queue metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}


// ============================================================
// SYSTEM METRICS
// GET /api/v1/admin/metrics/system
// ============================================================

export async function getSystemMetrics(req, res, next) {
  try {
    const memory = process.memoryUsage();

    const redisPing = await redisClient.ping();


    return res.status(200).json({
      success: true,

      data: {
        node: {
          uptimeSeconds: Math.floor(process.uptime()),

          memory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external
          },

          version: process.version,

          environment: process.env.NODE_ENV || "development"
        },

        redis: {
          status: redisPing === "PONG"
            ? "healthy"
            : "unhealthy"
        },

        mongodb: {
          status:
            mongoose.connection.readyState === 1
              ? "healthy"
              : "unhealthy"
        },

        timestamp: new Date().toISOString()
      },

      message: "System metrics fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}