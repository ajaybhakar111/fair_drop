import { request } from "./http";

// GET /notifications?page=&limit=&unread=true
export function fetchNotifications({ page = 1, limit = 20, unread } = {}) {
  return request("/notifications", { query: { page, limit, unread: unread ? "true" : undefined } });
}

// PATCH /notifications/:notificationId/read
export function markNotificationRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, { method: "PATCH" });
}
