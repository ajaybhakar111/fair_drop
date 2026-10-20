import { request, apiBase } from "./http";

// The backend populates drop.eventId with the event. The screens want a flat drop.
function flattenDrop(drop) {
  const populated = drop.eventId && typeof drop.eventId === "object";
  const event = populated ? drop.eventId : null;
  return {
    ...drop,
    eventId: populated ? event.id : drop.eventId,
    event,
    ticketCount: event?.totalTickets ?? drop.ticketCount ?? 0,
  };
}

// GET /drops/:dropId
export async function fetchDrop(dropId) {
  const res = await request(`/drops/${dropId}`).catch(mapBadId);
  return { ...res, data: { drop: flattenDrop(res.data.drop) } };
}

// GET /drops/:dropId/my-entry   (404 ENTRY_NOT_FOUND when the user hasn't joined)
export async function fetchMyEntry(dropId) {
  const res = await request(`/drops/${dropId}/my-entry`).catch(mapBadId);
  return res;
}

// GET /drops/:dropId/status
// Reshaped so the screen gets { drop, stats, timing, allocation.progress }
export async function fetchStatus(dropId) {
  const res = await request(`/drops/${dropId}/status`).catch(mapBadId);
  const d = res.data;

  let progress = 0;
  if (d.status === "COMPLETED") progress = 100;
  else if (d.allocation && d.allocation.totalEntries > 0) {
    progress = Math.min(99, Math.floor((d.allocation.processedCount / d.allocation.totalEntries) * 100));
  }

  return {
    ...res,
    data: {
      drop: { id: d.dropId, status: d.status },
      stats: {
        eligibleEntries: d.entries.total,
        selectedEntries: d.entries.selected,
      },
      timing: { opensAt: d.opensAt, closesAt: d.closesAt },
      allocation: { ...(d.allocation || {}), progress },
    },
  };
}

// POST /drops/:dropId/join   (header: Idempotency-Key)
export async function joinDrop(dropId, idempotencyKey) {
  return request(`/drops/${dropId}/join`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  }).catch(mapBadId);
}

// GET /drops/:dropId/result
// Reshaped to { status: PENDING | NOT_SELECTED | SELECTED, reservationId, ticket, reservation }
export async function fetchResult(dropId) {
  const res = await request(`/drops/${dropId}/result`).catch(mapBadId);
  const d = res.data;

  if (d.status === "NOT_SELECTED") return { ...res, data: { status: "NOT_SELECTED" } };

  if (d.status === "SELECTED" && d.reservation) {
    return {
      ...res,
      data: {
        status: "SELECTED",
        reservationId: d.reservation.reservationId,
        ticket: {
          id: d.reservation.ticket?.ticketId,
          ticketNumber: d.reservation.ticket?.ticketNumber,
        },
        reservation: {
          status: d.reservation.status,
          expiresAt: d.reservation.expiresAt,
          confirmedAt: d.reservation.confirmedAt,
        },
      },
    };
  }

  // ALLOCATION_PENDING, or selected but the reservation isn't written yet
  return { ...res, data: { status: "PENDING" } };
}

// GET /drops/:dropId/stream   (Server-Sent Events, the cookie is sent automatically)
export function openDropStream(dropId, onEvent) {
  if (typeof EventSource === "undefined") return () => {};

  const es = new EventSource(`${apiBase}/drops/${dropId}/stream`, { withCredentials: true });
  ["allocation_completed", "reservation_created", "reservation_confirmed", "reservation_expired"].forEach((name) => {
    es.addEventListener(name, (e) => {
      let payload = null;
      try {
        payload = JSON.parse(e.data);
      } catch {
        /* ignore */
      }
      onEvent(name, payload);
    });
  });

  return () => es.close();
}

// A malformed id can never be a real drop
function mapBadId(err) {
  if (err.code === "VALIDATION_ERROR") err.code = "DROP_NOT_FOUND";
  throw err;
}
