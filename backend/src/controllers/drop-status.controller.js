import mongoose from "mongoose";

import Drop from "../models/Drop.js";
import Allocation from "../models/Allocation.js";
import Entry from "../models/Entry.js";
import Reservation from "../models/Reservation.js";


/*
============================================================
GET DROP STATUS
GET /api/v1/drops/:dropId/status
============================================================
*/

export async function getDropStatus(req, res, next) {
  try {
    const { dropId } = req.params;

    // ------------------------------------------------------
    // Validate Drop ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }

    // ------------------------------------------------------
    // Find Drop
    // ------------------------------------------------------

    const drop = await Drop.findById(dropId).lean();

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    // ------------------------------------------------------
    // Find Allocation
    // ------------------------------------------------------

    const allocation = await Allocation.findOne({
      dropId
    }).lean();

    // ------------------------------------------------------
    // Count Entries
    // ------------------------------------------------------

    const totalEntries = await Entry.countDocuments({
      dropId
    });

    const eligibleEntries = await Entry.countDocuments({
      dropId,
      status: "ELIGIBLE"
    });

    const selectedCount = await Entry.countDocuments({
      dropId,
      status: "SELECTED"
    });

    const notSelectedCount = await Entry.countDocuments({
      dropId,
      status: "NOT_SELECTED"
    });

    // ------------------------------------------------------
    // Response
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      data: {
        dropId: drop._id,
        status: drop.status,

        opensAt: drop.opensAt,
        closesAt: drop.closesAt,

        allocation: allocation
          ? {
              allocationId: allocation._id,
              status: allocation.status,
              totalEntries: allocation.totalEntries,
              totalTickets: allocation.totalTickets,
              processedCount: allocation.processedCount,
              selectedCount: allocation.selectedCount,
              startedAt: allocation.startedAt,
              completedAt: allocation.completedAt
            }
          : null,

        entries: {
          total: totalEntries,
          eligible: eligibleEntries,
          selected: selectedCount,
          notSelected: notSelectedCount
        }
      }
    });

  } catch (error) {
    next(error);
  }
}


/*
============================================================
GET DROP RESULT
GET /api/v1/drops/:dropId/result
============================================================
*/

export async function getDropResult(req, res, next) {
  try {
    const { dropId } = req.params;

    // ------------------------------------------------------
    // Validate Drop ID
    // ------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }

    // ------------------------------------------------------
    // Find Drop
    // ------------------------------------------------------

    const drop = await Drop.findById(dropId).lean();

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    // ------------------------------------------------------
    // Find User Entry
    // ------------------------------------------------------

    const entry = await Entry.findOne({
      dropId,
      userId: req.user.id
    }).lean();

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ENTRY_NOT_FOUND",
          message: "You have not joined this drop"
        }
      });
    }

    // ------------------------------------------------------
    // Allocation not completed yet
    // ------------------------------------------------------

    if (
      entry.status === "ELIGIBLE" &&
      drop.status !== "COMPLETED"
    ) {
      return res.status(202).json({
        success: true,
        data: {
          dropId: drop._id,
          status: "ALLOCATION_PENDING",
          selected: null,
          entryStatus: entry.status
        }
      });
    }

    // ------------------------------------------------------
    // User NOT selected
    // ------------------------------------------------------

    if (entry.status === "NOT_SELECTED") {
      return res.status(200).json({
        success: true,
        data: {
          dropId: drop._id,
          selected: false,
          status: "NOT_SELECTED",
          entryId: entry._id
        }
      });
    }

    // ------------------------------------------------------
    // User SELECTED
    // ------------------------------------------------------

    if (entry.status === "SELECTED") {

      const reservation = await Reservation.findOne({
        entryId: entry._id,
        userId: req.user.id,
        dropId
      })
        .populate("ticketId")
        .lean();

      return res.status(200).json({
        success: true,
        data: {
          dropId: drop._id,
          selected: true,
          status: "SELECTED",

          entryId: entry._id,

          reservation: reservation
            ? {
                reservationId: reservation._id,
                status: reservation.status,
                expiresAt: reservation.expiresAt,
                confirmedAt: reservation.confirmedAt,

                ticket: reservation.ticketId
                  ? {
                      ticketId: reservation.ticketId._id,
                      ticketNumber:
                        reservation.ticketId.ticketNumber,
                      status: reservation.ticketId.status
                    }
                  : null
              }
            : null
        }
      });
    }

    // ------------------------------------------------------
    // Fallback
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      data: {
        dropId: drop._id,
        selected: false,
        status: entry.status,
        entryId: entry._id
      }
    });

  } catch (error) {
    next(error);
  }
}