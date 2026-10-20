import { publishDropEvent } from "../controllers/drop-stream.controller.js";

export function publishAllocationCompleted(dropId, data) {
  publishDropEvent(
    dropId.toString(),
    "allocation_completed",
    data
  );
}

export function publishReservationCreated(dropId, data) {
  publishDropEvent(
    dropId.toString(),
    "reservation_created",
    data
  );
}

export function publishReservationConfirmed(dropId, data) {
  publishDropEvent(
    dropId.toString(),
    "reservation_confirmed",
    data
  );
}

export function publishReservationExpired(dropId, data) {
  publishDropEvent(
    dropId.toString(),
    "reservation_expired",
    data
  );
}