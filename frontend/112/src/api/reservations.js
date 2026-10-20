import { request } from "./http";

// GET /reservations/:reservationId
export async function fetchReservation(reservationId) {
  try {
    const res = await request(`/reservations/${reservationId}`);
    const r = res.data.reservation;
    const ticket = r.ticketId && typeof r.ticketId === "object" ? r.ticketId : null;
    const drop = r.dropId && typeof r.dropId === "object" ? r.dropId : null;
    return {
      ...res,
      data: {
        reservation: {
          id: r.id,
          status: r.status,
          expiresAt: r.expiresAt,
          confirmedAt: r.confirmedAt,
          ticket: ticket ? { id: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status } : null,
          drop: drop ? { id: drop.id, name: drop.name, eventId: drop.eventId } : null,
        },
      },
    };
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") err.code = "RESERVATION_NOT_FOUND";
    throw err;
  }
}

// POST /reservations/:reservationId/cancel   (header: Idempotency-Key, 8+ characters)
export async function cancelReservation(reservationId, idempotencyKey) {
  const res = await request(`/reservations/${reservationId}/cancel`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });

  const d = res.data;
  return {
    ...res,
    data: {
      status: d.status || "CANCELLED",
      cancelledAt: d.cancelledAt || null,
      ticketId: d.ticketId || null,
    },
  };
}

// POST /reservations/:reservationId/confirm   (header: Idempotency-Key, 8+ characters)
export async function confirmReservation(reservationId, idempotencyKey) {
  const res = await request(`/reservations/${reservationId}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
  // Fresh confirm => { reservationId, status, ticketId, confirmedAt }
  // Repeat confirm => { reservation, ticket }
  const d = res.data;
  return {
    ...res,
    data: {
      status: d.status || d.reservation?.status || "CONFIRMED",
      confirmedAt: d.confirmedAt || d.reservation?.confirmedAt || null,
    },
  };
}
