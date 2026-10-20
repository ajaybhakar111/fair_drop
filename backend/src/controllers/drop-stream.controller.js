import mongoose from "mongoose";

const clients = new Map();

/*
  clients structure:

  dropId -> Set of response objects

  Example:

  {
    "drop123" -> Set(res1, res2, res3)
  }
*/

// ============================================================
// GET /api/v1/drops/:dropId/stream
// ============================================================

export async function streamDrop(req, res, next) {
  try {
    const { dropId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(dropId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid drop ID",
        },
      });
    }

    // --------------------------------------------------------
    // SSE headers
    // --------------------------------------------------------

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Useful when running behind NGINX
    res.setHeader("X-Accel-Buffering", "no");

    // --------------------------------------------------------
    // Store connection
    // --------------------------------------------------------

    if (!clients.has(dropId)) {
      clients.set(dropId, new Set());
    }

    clients.get(dropId).add(res);

    // --------------------------------------------------------
    // Send initial connection event
    // --------------------------------------------------------

    res.write(
      `event: connected\n` +
      `data: ${JSON.stringify({
        dropId,
        message: "SSE connection established",
      })}\n\n`
    );

    // --------------------------------------------------------
    // Heartbeat
    // --------------------------------------------------------

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 25000);

    // --------------------------------------------------------
    // Client disconnected
    // --------------------------------------------------------

    req.on("close", () => {
      clearInterval(heartbeat);

      const dropClients = clients.get(dropId);

      if (dropClients) {
        dropClients.delete(res);

        if (dropClients.size === 0) {
          clients.delete(dropId);
        }
      }

      res.end();
    });
  } catch (error) {
    next(error);
  }
}


// ============================================================
// SEND EVENT TO USERS CONNECTED TO A DROP
// ============================================================

export function publishDropEvent(dropId, eventName, data) {
  const dropClients = clients.get(dropId);

  if (!dropClients || dropClients.size === 0) {
    return;
  }

  const message =
    `event: ${eventName}\n` +
    `data: ${JSON.stringify(data)}\n\n`;

  for (const client of dropClients) {
    try {
      client.write(message);
    } catch (error) {
      dropClients.delete(client);
    }
  }
}