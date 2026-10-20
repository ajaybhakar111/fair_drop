import mongoose from "mongoose";

import Entry from "../models/Entry.js";
import Drop from "../models/Drop.js";
import {
  trackJoinAttempt,
  trackDuplicateAttempt
} from "../services/risk.service.js";
import { redisClient } from "../config/redis.js";

import {
  joinRateLimitKey,
  joinIdempotencyKey,
  joinAbuseCounterKey
} from "../utils/redis.key.js";

// ============================================================
// CONFIGURATION
// ============================================================

const RATE_LIMIT_WINDOW_SECONDS = 10;

// Maximum join attempts allowed inside the window.
//
// This is NOT the fairness limit.
// The MongoDB unique index is the actual
// one-entry-per-user-per-drop protection.
const MAX_JOIN_ATTEMPTS = 10;

const IDEMPOTENCY_TTL_SECONDS = 60 * 10;

const ABUSE_COUNTER_TTL_SECONDS = 60 * 15;

// ============================================================
// POST /api/v1/drops/:dropId/join
// ============================================================

export async function joinDrop(req, res, next) {
  try {
    const { dropId } = req.params;


    const userId = req.user.id;

    await trackJoinAttempt(
  userId,
  dropId
);

    const idempotencyKey = req.get("Idempotency-Key");

    // --------------------------------------------------------
    // 1. Validate Drop ID
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }

    // --------------------------------------------------------
    // 2. Require Idempotency-Key
    // --------------------------------------------------------

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Idempotency-Key header is required"
        }
      });
    }

    // Prevent extremely large keys
    if (idempotencyKey.length > 200) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Idempotency-Key is too long"
        }
      });
    }

    // --------------------------------------------------------
    // 3. Check Redis availability
    // --------------------------------------------------------

    if (!redisClient.isReady) {
      return res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Redis is currently unavailable"
        }
      });
    }

    // --------------------------------------------------------
    // 4. Find Drop
    // --------------------------------------------------------bor9edijy to case )

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

    // --------------------------------------------------------
    // 5. Drop must be OPEN
    // --------------------------------------------------------

    if (drop.status !== "OPEN") {
      return res.status(409).json({
        success: false,
        error: {
          code: "DROP_NOT_OPEN",
          message: `Drop is currently ${drop.status}`
        }
      });
    }

    // --------------------------------------------------------
    // 6. Idempotency
    // --------------------------------------------------------

    const idempotencyRedisKey = joinIdempotencyKey(
      userId,
      dropId,
      idempotencyKey
    );

    const existingIdempotency = await redisClient.get(
      idempotencyRedisKey
    );

    if (existingIdempotency) {
      const parsed = JSON.parse(existingIdempotency);

      return res.status(parsed.httpStatus).json(
        parsed.response
      );
    }

    // --------------------------------------------------------
    // 7. Rate limiting
    // --------------------------------------------------------

    const rateLimitKey = joinRateLimitKey(
      userId,
      dropId
    );

    const requestCount = await redisClient.incr(
      rateLimitKey
    );

    if (requestCount === 1) {
      await redisClient.expire(
        rateLimitKey,
        RATE_LIMIT_WINDOW_SECONDS
      );
    }

    if (requestCount > MAX_JOIN_ATTEMPTS) {
      // Track abuse signal
      const abuseKey = joinAbuseCounterKey(
        userId,
        dropId
      );

      await redisClient.incr(abuseKey);
      await redisClient.expire(
        abuseKey,
        ABUSE_COUNTER_TTL_SECONDS
      );

      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "Too many join attempts. Please try again later."
        }
      });
    }

    // --------------------------------------------------------
    // 8. Check existing Entry
    // --------------------------------------------------------

    const existingEntry = await Entry.findOne({
      userId,
      dropId
    });

if (existingEntry) {

  await trackDuplicateAttempt(
    userId,
    dropId
  );

  return res.status(409).json({
    success: false,
    error: {
      code: "ALREADY_JOINED",
      message: "You have already joined this drop"
    }
  });
}
    // --------------------------------------------------------
    // 9. Create Entry
    // --------------------------------------------------------

    let entry;

    try {
      entry = await Entry.create({
        userId,
        dropId,
        status: "ELIGIBLE"
      });
    } catch (error) {
      // ------------------------------------------------------
      // MongoDB unique index protection
      //
      // If two requests reach MongoDB simultaneously,
      // one can win the race and the other gets E11000.
      // ------------------------------------------------------

      if (error?.code === 11000) {
        const duplicateEntry = await Entry.findOne({
          userId,
          dropId
        });

        const response = {
          success: false,
          error: {
            code: "ALREADY_JOINED",
            message: "You have already joined this drop"
          },
          data: {
            entry: duplicateEntry
              ? {
                  id: duplicateEntry._id,
                  status: duplicateEntry.status,
                  joinedAt: duplicateEntry.joinedAt
                }
              : null
          }
        };

        await redisClient.set(
          idempotencyRedisKey,
          JSON.stringify({
            httpStatus: 409,
            response
          }),
          {
            EX: IDEMPOTENCY_TTL_SECONDS
          }
        );

        return res.status(409).json(response);
      }

      throw error;
    }

    // --------------------------------------------------------
    // 10. Store successful idempotent response
    // --------------------------------------------------------

    const response = {
      success: true,
      data: {
        entry: {
          id: entry._id,
          dropId: entry.dropId,
          status: entry.status,
          joinedAt: entry.joinedAt
        }
      },
      message: "Successfully joined the drop"
    };

    await redisClient.set(
      idempotencyRedisKey,
      JSON.stringify({
        httpStatus: 201,
        response
      }),
      {
        EX: IDEMPOTENCY_TTL_SECONDS
      }
    );

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET MY ENTRY
// GET /api/v1/drops/:dropId/my-entry
// ============================================================

export async function getMyEntry(req, res, next) {
  try {
    const { dropId } = req.params;

    const userId = req.user.id;

    // --------------------------------------------------------
    // Validate Drop ID
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID"
        }
      });
    }

    // --------------------------------------------------------
    // Find Entry
    // --------------------------------------------------------

    const entry = await Entry.findOne({
      userId,
      dropId
    }).select(
      "_id userId dropId status joinedAt createdAt updatedAt"
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ENTRY_NOT_FOUND",
          message: "You have not joined this drop"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        entry
      },
      message: "Entry fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}