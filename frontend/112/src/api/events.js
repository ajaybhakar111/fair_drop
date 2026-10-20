import { request } from "./http";

// GET /events?page=&limit=&status=
export function fetchEvents({ page = 1, limit = 6, status } = {}) {
  return request("/events", { query: { page, limit, status } });
}

// GET /events/:eventId   (the backend returns the event together with its drop)
export async function fetchEventById(eventId) {
  try {
    const res = await request(`/events/${eventId}`);
    const { event, drop } = res.data;
    return {
      ...res,
      data: {
        event,
        drop: drop ? { ...drop, ticketCount: event.totalTickets } : null,
      },
    };
  } catch (err) {
    // A malformed id can never match an event
    if (err.code === "VALIDATION_ERROR") err.code = "EVENT_NOT_FOUND";
    throw err;
  }
}
