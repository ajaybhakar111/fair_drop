import { request } from "./http";

// GET /tickets/my
export function fetchMyTickets() {
  return request("/tickets/my");
}

// GET /tickets/:ticketId
export function fetchTicket(ticketId) {
  return request(`/tickets/${ticketId}`);
}
