import mongoose from "mongoose";

import Drop from "../models/Drop.js";
import Event from "../models/Event.js";

// ============================================================
// CREATE DROP
// POST /api/v1/drops
// ============================================================

export async function createDrop(req, res, next) {
  try {
    const {
      eventId,
      name,
      opensAt,
      closesAt,
      allocationMethod
    } = req.body;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (!eventId || !name || !opensAt || !closesAt) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "eventId, name, opensAt and closesAt are required"
        }
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid eventId"
        }
      });
    }

    const openDate = new Date(opensAt);
    const closeDate = new Date(closesAt);

    if (
      Number.isNaN(openDate.getTime()) ||
      Number.isNaN(closeDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid opensAt or closesAt"
        }
      });
    }

    if (closeDate <= openDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "closesAt must be after opensAt"
        }
      });
    }

    // --------------------------------------------------------
    // Verify event exists
    // --------------------------------------------------------

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Event not found"
        }
      });
    }

    // --------------------------------------------------------
    // Create drop
    // --------------------------------------------------------

    const drop = await Drop.create({
      eventId,
      name,
      opensAt: openDate,
      closesAt: closeDate,
      allocationMethod:
        allocationMethod || "BATCHED_RANDOM",
      status: "SCHEDULED"
    });

    return res.status(201).json({
      success: true,
      data: {
        drop
      },
      message: "Drop created successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET DROP
// GET /api/v1/drops/:dropId
// ============================================================

export async function getDrop(req, res, next) {
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

    const drop = await Drop.findById(dropId).populate(
      "eventId"
    );

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        drop
      },
      message: "Drop fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// UPDATE DROP
// PATCH /api/v1/drops/:dropId
// ============================================================

export async function updateDrop(req, res, next) {
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

    const drop = await Drop.findById(dropId);

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    // Don't allow editing an active/closed/completed drop
    if (
      ["OPEN", "CLOSED", "ALLOCATING", "COMPLETED"].includes(
        drop.status
      )
    ) {
      return res.status(409).json({
        success: false,
        error: {
          code: "DROP_ALREADY_STARTED",
          message:
            "This drop can no longer be modified"
        }
      });
    }

    const allowedFields = [
      "name",
      "opensAt",
      "closesAt",
      "allocationMethod"
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        drop[field] = req.body[field];
      }
    }

    if (drop.opensAt && drop.closesAt) {
      if (drop.closesAt <= drop.opensAt) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "closesAt must be after opensAt"
          }
        });
      }
    }

    await drop.save();

    return res.status(200).json({
      success: true,
      data: {
        drop
      },
      message: "Drop updated successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// START DROP
// POST /api/v1/drops/:dropId/start
// ============================================================

export async function startDrop(req, res, next) {
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

    const drop = await Drop.findById(dropId);

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    if (drop.status !== "SCHEDULED") {
      return res.status(409).json({
        success: false,
        error: {
          code: "INVALID_DROP_STATE",
          message:
            `Cannot start drop from ${drop.status} state`
        }
      });
    }

    drop.status = "OPEN";

    await drop.save();

    return res.status(200).json({
      success: true,
      data: {
        drop
      },
      message: "Drop opened successfully"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// CLOSE DROP
// POST /api/v1/drops/:dropId/close
// ============================================================

export async function closeDrop(req, res, next) {
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

    const drop = await Drop.findById(dropId);

    if (!drop) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DROP_NOT_FOUND",
          message: "Drop not found"
        }
      });
    }

    if (drop.status !== "OPEN") {
      return res.status(409).json({
        success: false,
        error: {
          code: "INVALID_DROP_STATE",
          message:
            `Cannot close drop from ${drop.status} state`
        }
      });
    }

    drop.status = "CLOSED";

    await drop.save();

    return res.status(200).json({
      success: true,
      data: {
        drop
      },
      message: "Drop closed successfully"
    });
  } catch (error) {
    next(error);
  }
}