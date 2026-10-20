import mongoose from "mongoose";
import crypto from "crypto";
import Drop from "../models/Drop.js";
import Entry from "../models/Entry.js";
import Ticket from "../models/Ticket.js";
import Allocation from "../models/Allocation.js";

import { allocationQueue } from "../queues/allocation.queue.js";

export async function startAllocation(req, res, next) {
  try {
    const { dropId } = req.params;

    // --------------------------------------------------
    // 1. Validate Drop ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }

    // --------------------------------------------------
    // 2. Find Drop
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 3. Allocation is allowed ONLY after drop closes
    // --------------------------------------------------

    if (drop.status !== "CLOSED") {
      return res.status(409).json({
        success: false,
        error: {
          code: "INVALID_DROP_STATE",
          message: `Allocation cannot start while drop status is ${drop.status}. Drop must be CLOSED.`
        }
      });
    }

    // --------------------------------------------------
    // 4. Check whether allocation already exists
    // --------------------------------------------------

    const existingAllocation = await Allocation.findOne({
      dropId
    });

    if (existingAllocation) {
      return res.status(409).json({
        success: false,
        error: {
          code: "ALLOCATION_ALREADY_EXISTS",
          message: "Allocation has already been created for this drop"
        },
        data: {
          allocationId: existingAllocation._id,
          status: existingAllocation.status
        }
      });
    }

    // --------------------------------------------------
    // 5. Count eligible entries
    // --------------------------------------------------

    const totalEntries = await Entry.countDocuments({
      dropId,
      status: "ELIGIBLE"
    });

    // --------------------------------------------------
    // 6. Count available tickets
    // --------------------------------------------------

    const totalTickets = await Ticket.countDocuments({
      eventId: drop.eventId,
      status: "AVAILABLE"
    });

    // --------------------------------------------------
    // 7. Validate that allocation is possible
    // --------------------------------------------------

    if (totalEntries === 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "NO_ELIGIBLE_ENTRIES",
          message: "No eligible entries found for this drop"
        }
      });
    }

    if (totalTickets === 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "NO_AVAILABLE_TICKETS",
          message: "No available tickets found for this event"
        }
      });
    }

    // --------------------------------------------------
    // 8. Create Allocation record
    // --------------------------------------------------

   const allocationSeed = crypto.randomBytes(32).toString("hex");

const allocation = await Allocation.create({
  dropId,
  allocationSeed,
  status: "PENDING",
  totalEntries,
  totalTickets,
  processedCount: 0,
  selectedCount: 0
});
    // --------------------------------------------------
    // 9. Add BullMQ job
    // --------------------------------------------------
console.log("📤 Adding allocation job to BullMQ...");
console.log("Queue name:", allocationQueue.name);
console.log("Drop ID:", dropId);
console.log("Allocation ID:", allocation._id.toString());
    const job = await allocationQueue.add(
      "allocate-drop",
      {
        dropId: dropId.toString(),
        allocationId: allocation._id.toString()
      },
      {
        jobId: `allocation-${dropId}`
      }
    );

    // --------------------------------------------------
    // 10. Return response
    // --------------------------------------------------

    return res.status(202).json({
      success: true,

      data: {
        allocationId: allocation._id,
        dropId,
        status: allocation.status,
        totalEntries,
        totalTickets,
        jobId: job.id
      },

      message: "Allocation job queued successfully"
    });
  } catch (error) {
    // Handle race condition where another request
    // created the allocation first.
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        error: {
          code: "ALLOCATION_ALREADY_EXISTS",
          message: "Allocation already exists for this drop"
        }
      });
    }

    next(error);
  }
}