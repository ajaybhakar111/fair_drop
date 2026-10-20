import Notification from "../models/Notification.js";


// ============================================================
// CREATE NOTIFICATION
// ============================================================

export async function createNotification({
  userId,
  type,
  title,
  message,
  dropId = null,
  reservationId = null,
  ticketId = null
}) {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      dropId,
      reservationId,
      ticketId
    });

    return notification;
  } catch (error) {
    console.error(
      "❌ Failed to create notification:",
      error
    );

    // Notification failure should NOT break
    // the main ticket/allocation flow.
    return null;
  }
}


// ============================================================
// ALLOCATION SELECTED
// ============================================================

export async function notifyAllocationSelected({
  userId,
  dropId,
  reservationId,
  ticketId
}) {
  return createNotification({
    userId,
    type: "ALLOCATION_SELECTED",
    title: "🎟️ You were selected!",
    message:
      "Congratulations! You have been selected for a ticket. Please confirm your reservation before it expires.",
    dropId,
    reservationId,
    ticketId
  });
}


// ============================================================
// ALLOCATION NOT SELECTED
// ============================================================

export async function notifyAllocationNotSelected({
  userId,
  dropId
}) {
  return createNotification({
    userId,
    type: "ALLOCATION_NOT_SELECTED",
    title: "Allocation result",
    message:
      "You were not selected for a ticket in this drop. Better luck next time!",
    dropId
  });
}


// ============================================================
// RESERVATION CREATED
// ============================================================

export async function notifyReservationCreated({
  userId,
  dropId,
  reservationId,
  ticketId
}) {
  return createNotification({
    userId,
    type: "RESERVATION_CREATED",
    title: "Ticket reserved",
    message:
      "Your ticket has been temporarily reserved. Please confirm it before the reservation expires.",
    dropId,
    reservationId,
    ticketId
  });
}


// ============================================================
// RESERVATION CONFIRMED
// ============================================================

export async function notifyReservationConfirmed({
  userId,
  dropId,
  reservationId,
  ticketId
}) {
  return createNotification({
    userId,
    type: "RESERVATION_CONFIRMED",
    title: "🎉 Ticket confirmed!",
    message:
      "Your ticket has been successfully confirmed.",
    dropId,
    reservationId,
    ticketId
  });
}


// ============================================================
// RESERVATION EXPIRED
// ============================================================

export async function notifyReservationExpired({
  userId,
  dropId,
  reservationId,
  ticketId
}) {
  return createNotification({
    userId,
    type: "RESERVATION_EXPIRED",
    title: "Reservation expired",
    message:
      "Your ticket reservation expired because it was not confirmed in time.",
    dropId,
    reservationId,
    ticketId
  });
}