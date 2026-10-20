import express from "express";
import { allocationQueue } from "../queues/allocation.queue.js";

const router = express.Router();

router.post("/allocation", async (req, res, next) => {
  try {
    const { dropId } = req.body;

    if (!dropId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "dropId is required"
        }
      });
    }

    const job = await allocationQueue.add(
      "allocate-drop",
      {
        dropId
      },
      {
        jobId: `allocation-${dropId}`
      }
    );

    return res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        dropId,
        queue: "fair-drop-allocation"
      },
      message: "Allocation job queued successfully"
    });
  } catch (error) {
    next(error);
  }
});

export default router;