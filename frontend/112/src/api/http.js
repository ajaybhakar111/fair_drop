// Single place that talks to the backend.
// - Sends the HTTP-only auth cookie (credentials: "include")
// - Turns backend errors into Error objects with a `code` the screens already understand
// - Maps MongoDB `_id` to `id` so the UI never has to care

export const apiBase = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

const USER_KEY = "fairdrop_user";

/* ---------- Cached signed-in user (the real session is the cookie) ---------- */

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function storeUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

/* ---------- Helpers ---------- */

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "__v") continue;
      out[k] = normalize(v);
    }
    if (out._id !== undefined && out.id === undefined) out.id = out._id;
    return out;
  }
  return value;
}

function makeError(code, message, status, data) {
  const err = new Error(message || code);
  err.code = code;
  err.status = status;
  err.data = data || null;
  return err;
}

function toQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

/* ---------- The request function ---------- */

export async function request(path, { method = "GET", body, headers = {}, query } = {}) {
  let res;
  try {
    res = await fetch(`${apiBase}${path}${toQuery(query)}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw makeError("NETWORK_ERROR", "Could not reach the server", 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok || (json && json.success === false)) {
    const code =
      json?.error?.code ||
      (res.status === 401 ? "AUTH_REQUIRED" : res.status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");

    // Cookie expired or missing: forget the cached user so screens send the person to log in
    if (res.status === 401 && code === "AUTH_REQUIRED") clearStoredUser();

    throw makeError(code, json?.error?.message, res.status, json?.data ? normalize(json.data) : null);
  }

  return {
    success: true,
    status: res.status,
    message: json?.message || "Success",
    data: normalize(json?.data ?? {}),
  };
}

/* Health probes must not throw on 503, because "unhealthy" is a valid answer */
export async function probe(path) {
  const started = performance.now();
  try {
    const res = await fetch(`${apiBase}${path}`, { credentials: "include", headers: { Accept: "application/json" } });
    return { ok: res.ok, latencyMs: Math.round(performance.now() - started), reachable: true };
  } catch {
    return { ok: false, latencyMs: 0, reachable: false };
  }
}
