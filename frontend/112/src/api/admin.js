import { request, probe } from "./http";

const fieldsError = (fields) => Object.assign(new Error("VALIDATION_ERROR"), { code: "VALIDATION_ERROR", fields });

/* ================= Events and tickets ================= */

// GET /events?includeDrafts=true  (the admin sees every event)
export async function fetchAdminEvents() {
  const res = await request("/events", {
    query: {
      page: 1,
      limit: 100,
      includeDrafts: "true"
    }
  });

  return {
    ...res,
    data: {
      ...res.data,
      events: res.data.events.map((event) => ({
        ...event,
        ticketsGenerated: event.ticketsGenerated ?? 0
      }))
    }
  };
}

// POST /events, then PATCH /events/:id { status: "ACTIVE" } so fans can see it
export async function createEvent(body) {
  const fields = {};
  if (!body.name || body.name.trim().length < 3) fields.name = "Enter an event name (at least 3 characters).";
  if (!body.venue || !body.venue.trim()) fields.venue = "Enter a venue.";
  if (!body.date) fields.date = "Pick a date.";
  if (!body.startTime) fields.startTime = "Pick a start time.";
  const n = Number(body.totalTickets);
  if (!Number.isInteger(n) || n < 1 || n > 100000) fields.totalTickets = "Enter a whole number from 1 to 100,000.";
  if (Object.keys(fields).length) throw fieldsError(fields);

  const created = await request("/events", {
    method: "POST",
    body: {
      name: body.name.trim(),
      description: (body.description || "").trim(),
      venue: body.venue.trim(),
      date: body.date,
      startTime: body.startTime,
      totalTickets: n,
    },
  });

  const activated = await request(`/events/${created.data.event.id}`, {
    method: "PATCH",
    body: { status: "ACTIVE" },
  });

  return {
    ...created,
    data: { event: { ...created.data.event, ...activated.data.event, ticketsGenerated: 0 } },
    message: "Event created",
  };
}

// POST /tickets/events/:eventId/tickets
// The backend generates every ticket for the event in one go (one call per event).
export async function generateTickets(eventId) {
  try {
    const res = await request(`/tickets/events/${eventId}/tickets`, { method: "POST" });
    return { ...res, data: { created: res.data.totalTickets } };
  } catch (err) {
    if (err.code === "TICKETS_ALREADY_GENERATED") {
      throw Object.assign(err, { fields: { quantity: "Tickets were already generated for this event." } });
    }
    throw err;
  }
}

/* ================= Drops ================= */

// GET /admin/events/:eventId/drops
export function fetchEventDrops(eventId) {
  return request(`/admin/events/${eventId}/drops`);
}

// POST /admin/events/:eventId/drops
export async function createDrop(eventId, body) {
  const fields = {};
  if (!body.name || !body.name.trim()) fields.name = "Enter a drop name.";
  if (!body.opensAt) fields.opensAt = "Pick when the drop opens.";
  if (!body.closesAt) fields.closesAt = "Pick when the drop closes.";
  if (body.opensAt && body.closesAt && new Date(body.closesAt) <= new Date(body.opensAt)) {
    fields.closesAt = "Closing time must be after the opening time.";
  }
  if (Object.keys(fields).length) throw fieldsError(fields);

  return request(`/admin/events/${eventId}/drops`, {
    method: "POST",
    body: {
      name: body.name.trim(),
      opensAt: new Date(body.opensAt).toISOString(),
      closesAt: new Date(body.closesAt).toISOString(),
    },
  });
}

// POST /admin/drops/:dropId/open
export const openDrop = (dropId) => request(`/admin/drops/${dropId}/open`, { method: "POST" });

// POST /admin/drops/:dropId/close
export const closeDrop = (dropId) => request(`/admin/drops/${dropId}/close`, { method: "POST" });

// DELETE /admin/drops/:dropId
export const deleteDrop = (dropId) => request(`/admin/drops/${dropId}`, { method: "DELETE" });

// POST /admin/drops/:dropId/allocate   (queues the allocation job)
export const startAllocation = (dropId) => request(`/admin/drops/${dropId}/allocate`, { method: "POST" });

/* ================= Dashboard metrics ================= */

// GET /admin/metrics/{overview,traffic,abuse,queues,system}
export async function fetchDashboard() {
  const [o, t, a, q, s] = await Promise.all([
    request("/admin/metrics/overview"),
    request("/admin/metrics/traffic"),
    request("/admin/metrics/abuse"),
    request("/admin/metrics/queues"),
    request("/admin/metrics/system"),
  ]);

  const ov = o.data;
  const joinAttempts = t.data.rateLimits.reduce((sum, r) => sum + r.value, 0);
  const jobs = (c) => (c.waiting || 0) + (c.active || 0) + (c.delayed || 0);

  return {
    success: true,
    data: {
      traffic: { joinAttempts, activeClients: t.data.rateLimitKeys },
      users: { total: ov.users.total },
      entries: ov.entries,
      tickets: ov.tickets,
      drops: ov.drops,
      reservations: ov.reservations,
      abuse: { events: a.data.totalAbuseEvents, activeCounters: a.data.activeAbuseCounters },
      system: {
        queueDepth: jobs(q.data.allocation) + jobs(q.data.reservationExpiry),
        failedJobs: (q.data.allocation.failed || 0) + (q.data.reservationExpiry.failed || 0),
        heapUsedMb: Math.round(s.data.node.memory.heapUsed / 1024 / 1024),
        uptimeSeconds: s.data.node.uptimeSeconds,
      },
    },
  };
}

/* ================= Abuse ================= */

// GET /admin/metrics/abuse
// Counter keys look like "fairdrop:abuse:join:<userId>:<dropId>"
export async function fetchAbuseSignals() {
  const res = await request("/admin/metrics/abuse");
  const signals = res.data.abuseCounters
    .map((c) => {
      const parts = c.key.split(":");
      return {
        id: c.key,
        kind: parts[2] || "join",
        userId: parts[3] || "unknown",
        dropId: parts[4] || "unknown",
        count: c.count,
      };
    })
    .sort((x, y) => y.count - x.count);

  return { ...res, data: { total: res.data.totalAbuseEvents, signals } };
}

/* ================= Health ================= */

// GET /health, /health/mongodb, /health/redis, /admin/metrics/{queues,system}
export async function fetchHealth() {
  const [api, mongo, redis] = await Promise.all([probe("/health"), probe("/health/mongodb"), probe("/health/redis")]);

  if (!api.reachable) {
    throw Object.assign(new Error("NETWORK_ERROR"), { code: "NETWORK_ERROR" });
  }

  let queues = { status: "unhealthy", error: "SERVICE_UNAVAILABLE" };
  let node = null;

  try {
    const q = await request("/admin/metrics/queues");
    queues = {
      status: redis.ok ? "healthy" : "unhealthy",
      allocationQueue: q.data.allocation,
      reservationQueue: q.data.reservationExpiry,
    };
  } catch {
    /* Redis down or not an admin: leave queues unhealthy */
  }

  try {
    node = (await request("/admin/metrics/system")).data.node;
  } catch {
    /* ignore */
  }

  return {
    success: true,
    data: {
      api: {
        status: api.ok ? "healthy" : "unhealthy",
        latencyMs: api.latencyMs,
        uptimeSeconds: node?.uptimeSeconds ?? 0,
        version: node?.version ?? "unknown",
      },
      mongodb: mongo.ok
        ? { status: "healthy", latencyMs: mongo.latencyMs }
        : { status: "unhealthy", error: "SERVICE_UNAVAILABLE" },
      redis: redis.ok
        ? { status: "healthy", latencyMs: redis.latencyMs }
        : { status: "unhealthy", error: "SERVICE_UNAVAILABLE" },
      queues,
    },
  };
}
