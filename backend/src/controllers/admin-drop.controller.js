import mongoose from "mongoose";
import Event from "../models/Event.js";
import Drop from "../models/Drop.js";


// ============================================================
// CREATE DROP
// POST /api/v1/admin/events/:eventId/drops
// ============================================================

export async function createDrop(req, res, next) {
    try {
        const { eventId } = req.params;

        const {
            name,
            opensAt,
            closesAt,
            allocationMethod
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid event ID"
                }
            });
        }

        if (!name || !opensAt || !closesAt) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "name, opensAt and closesAt are required"
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

        const drop = await Drop.create({
            eventId,
            name,
            opensAt: openDate,
            closesAt: closeDate,
            allocationMethod: allocationMethod || "BATCHED_RANDOM",
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
// GET EVENT DROPS
// GET /api/v1/admin/events/:eventId/drops
// ============================================================

export async function getEventDrops(req, res, next) {
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

        const drops = await Drop.find({
            eventId
        })
            .sort({ opensAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                eventId,
                drops
            },
            message: "Event drops fetched successfully"
        });
    } catch (error) {
        next(error);
    }
}


// ============================================================
// UPDATE DROP
// PATCH /api/v1/admin/drops/:dropId
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

        const allowedFields = [
            "name",
            "opensAt",
            "closesAt",
            "allocationMethod",
            "status"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (updates.opensAt) {
            const date = new Date(updates.opensAt);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid opensAt"
                    }
                });
            }

            updates.opensAt = date;
        }

        if (updates.closesAt) {
            const date = new Date(updates.closesAt);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid closesAt"
                    }
                });
            }

            updates.closesAt = date;
        }

        if (
            updates.opensAt &&
            updates.closesAt &&
            updates.closesAt <= updates.opensAt
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "closesAt must be after opensAt"
                }
            });
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

        const drop = await Drop.findByIdAndUpdate(
            dropId,
            updates,
            {
                new: true,
                runValidators: true
            }
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
            message: "Drop updated successfully"
        });
    } catch (error) {
        next(error);
    }
}


// ============================================================
// DELETE DROP
// DELETE /api/v1/admin/drops/:dropId
// ============================================================

export async function deleteDrop(req, res, next) {
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

        if (
            ["ALLOCATING", "COMPLETED"].includes(drop.status)
        ) {
            return res.status(409).json({
                success: false,
                error: {
                    code: "DROP_ALREADY_COMPLETED",
                    message: "This drop cannot be deleted in its current state"
                }
            });
        }

        await Drop.findByIdAndDelete(dropId);

        return res.status(200).json({
            success: true,
            data: {
                dropId: drop._id
            },
            message: "Drop deleted successfully"
        });
    } catch (error) {
        next(error);
    }
}


// ============================================================
// OPEN DROP
// POST /api/v1/admin/drops/:dropId/open
// ============================================================

export async function openDrop(req, res, next) {
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

        // Only SCHEDULED drops can be opened
        if (drop.status !== "SCHEDULED") {
            return res.status(409).json({
                success: false,
                error: {
                    code: "INVALID_DROP_STATE",
                    message:
                        `Drop cannot be opened while status is ${drop.status}. ` +
                        "Drop must be SCHEDULED."
                }
            });
        }

        // Validate timing
        if (drop.status !== "SCHEDULED") {
            return res.status(409).json({
                success: false,
                error: {
                    code: "INVALID_DROP_STATE",
                    message:
                        `Drop cannot be opened while status is ${drop.status}. ` +
                        "Drop must be SCHEDULED."
                }
            });
        }
        drop.status = "OPEN";

        await drop.save();

        return res.status(200).json({
            success: true,
            data: {
                dropId: drop._id,
                status: drop.status,
                opensAt: drop.opensAt,
                closesAt: drop.closesAt
            },
            message: "Drop opened successfully"
        });
    } catch (error) {
        next(error);
    }
}


// ============================================================
// CLOSE DROP
// POST /api/v1/admin/drops/:dropId/close
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

        // Only OPEN drops can be closed
        if (drop.status !== "OPEN") {
            return res.status(409).json({
                success: false,
                error: {
                    code: "INVALID_DROP_STATE",
                    message:
                        `Drop cannot be closed while status is ${drop.status}. ` +
                        "Drop must be OPEN."
                }
            });
        }

        drop.status = "CLOSED";

        await drop.save();

        return res.status(200).json({
            success: true,
            data: {
                dropId: drop._id,
                status: drop.status,
                closesAt: drop.closesAt
            },
            message: "Drop closed successfully"
        });
    } catch (error) {
        next(error);
    }
}