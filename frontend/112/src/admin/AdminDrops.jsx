import React, { useCallback, useEffect, useState } from "react";
import {
  closeDrop,
  createDrop,
  deleteDrop,
  fetchAdminEvents,
  fetchEventDrops,
  openDrop,
  startAllocation,
} from "../api/admin";

const STATUS_LABEL = {
  SCHEDULED: "Scheduled",
  OPEN: "Open",
  CLOSED: "Closed",
  ALLOCATING: "Selecting winners",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ACTION_ERRORS = {
  INVALID_DROP_STATE: "That drop isn't in the right state for this action. Refresh and try again.",
  NO_AVAILABLE_TICKETS: "This event has no tickets yet. Generate its tickets on the Events page first.",
  NO_ELIGIBLE_ENTRIES: "Nobody joined this drop, so there's nothing to allocate.",
  ALLOCATION_ALREADY_EXISTS: "Allocation was already started for this drop.",
  DROP_ALREADY_COMPLETED: "This drop can't be deleted in its current state.",
  DROP_NOT_FOUND: "That drop no longer exists.",
  AUTH_REQUIRED: "Your admin session ended. Log in again to continue.",
  FORBIDDEN: "This account doesn't have admin access.",
};

const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const EMPTY = { name: "", opensAt: "", closesAt: "" };

export default function AdminDrops() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [drops, setDrops] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingDrops, setLoadingDrops] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState(null);

  // Events for the picker
  useEffect(() => {
    let cancelled = false;
    setLoadingEvents(true);
    setError(false);
    fetchAdminEvents()
      .then((r) => {
        if (cancelled) return;
        setEvents(r.data.events);
        setEventId((current) => current || r.data.events[0]?.id || "");
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoadingEvents(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const loadDrops = useCallback(
    async (silent) => {
      if (!eventId) {
        setDrops([]);
        return;
      }
      if (!silent) setLoadingDrops(true);
      try {
        const r = await fetchEventDrops(eventId);
        setDrops(r.data.drops);
        setError(false);
      } catch {
        if (!silent) setError(true);
      } finally {
        if (!silent) setLoadingDrops(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    loadDrops(false);
  }, [loadDrops]);

  // Keep the table fresh while a drop is being allocated (the status changes on its own)
  const allocating = drops.some((d) => d.status === "ALLOCATING");
  useEffect(() => {
    if (!allocating) return;
    const id = setInterval(() => loadDrops(true), 3000);
    return () => clearInterval(id);
  }, [allocating, loadDrops]);

  const selectedEvent = events.find((e) => e.id === eventId);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating || !eventId) return;
    setCreating(true);
    setErrors({});
    setNotice(null);
    try {
      const body = { ...form, name: form.name || `${selectedEvent?.name || "Event"} Ticket Drop` };
      const res = await createDrop(eventId, body);
      setDrops((list) => [...list, res.data.drop]);
      setForm(EMPTY);
      setNotice({ type: "ok", text: `"${res.data.drop.name}" was scheduled.` });
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && err.fields) setErrors(err.fields);
      else setNotice({ type: "error", text: ACTION_ERRORS[err.code] || "The drop couldn't be created. Try again in a moment." });
    } finally {
      setCreating(false);
    }
  };

  const run = async (drop, action, okText) => {
    if (busyId) return;
    setBusyId(drop.id);
    setNotice(null);
    try {
      await action(drop.id);
      setNotice({ type: "ok", text: okText });
      await loadDrops(true);
    } catch (err) {
      setNotice({ type: "error", text: ACTION_ERRORS[err.code] || "That didn't work. Try again in a moment." });
      await loadDrops(true);
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Drops</h1>
          <p className="admin-sub">Schedule a drop, open and close it, then run the random allocation.</p>
        </div>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="drop-event">Event</label>
          <select id="drop-event" value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={loadingEvents || events.length === 0}>
            {events.length === 0 && <option value="">No events yet</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      </header>

      {notice && (
        <div className={notice.type === "ok" ? "notice notice-ok" : "notice notice-error"} role="status">
          {notice.text}
        </div>
      )}

      {error && (
        <div className="state-box" role="alert">
          <h2 className="state-title">Drops didn't load</h2>
          <p className="state-text">Check that the backend is running, then try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => { setReloadKey((k) => k + 1); loadDrops(false); }}>
            Try again
          </button>
        </div>
      )}

      {!error && !loadingEvents && events.length === 0 && (
        <div className="state-box">
          <h2 className="state-title">Create an event first</h2>
          <p className="state-text">Drops belong to an event. Add one on the Events and tickets page.</p>
        </div>
      )}

      {!error && eventId && (
        <>
          <section className="panel" style={{ marginBottom: 20 }}>
            <h2 className="panel-title">New drop</h2>
            <p className="panel-sub">
              Tickets for this event: {selectedEvent ? `${selectedEvent.ticketsGenerated} of ${selectedEvent.totalTickets} generated` : "-"}
            </p>

            <form className="form-grid" onSubmit={handleCreate} noValidate>
              <div className="field">
                <label htmlFor="drop-name">Drop name</label>
                <input id="drop-name" value={form.name} onChange={setField("name")} aria-invalid={!!errors.name} placeholder={`${selectedEvent?.name || "Event"} Ticket Drop`} disabled={creating} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="field">
                <label htmlFor="drop-opens">Opens</label>
                <input id="drop-opens" type="datetime-local" value={form.opensAt} onChange={setField("opensAt")} aria-invalid={!!errors.opensAt} disabled={creating} />
                {errors.opensAt && <span className="field-error">{errors.opensAt}</span>}
              </div>

              <div className="field">
                <label htmlFor="drop-closes">Closes</label>
                <input id="drop-closes" type="datetime-local" value={form.closesAt} onChange={setField("closesAt")} aria-invalid={!!errors.closesAt} disabled={creating} />
                {errors.closesAt && <span className="field-error">{errors.closesAt}</span>}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-dark" disabled={creating}>
                  {creating ? "Scheduling..." : "Schedule drop"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">Drops for this event</h2>
            <p className="panel-sub">Scheduled drops open when you press Open. Closed drops can be allocated.</p>

            {loadingDrops && (
              <div aria-busy="true" aria-label="Loading drops">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />
                ))}
              </div>
            )}

            {!loadingDrops && drops.length === 0 && (
              <div className="state-box">
                <h2 className="state-title">No drops yet</h2>
                <p className="state-text">Schedule one with the form above.</p>
              </div>
            )}

            {!loadingDrops && drops.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Drop</th>
                      <th>Window</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drops.map((d) => {
                      const busy = busyId === d.id;
                      const locked = !!busyId;
                      return (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.name}</strong>
                            <div className="cell-sub">{d.id}</div>
                          </td>
                          <td>
                            {fmtTime(d.opensAt)}
                            <div className="cell-sub">to {fmtTime(d.closesAt)}</div>
                          </td>
                          <td>
                            <span className={`badge ${d.status === "OPEN" || d.status === "COMPLETED" ? "badge-ok" : d.status === "CANCELLED" ? "badge-bad" : "badge-neutral"}`}>
                              {STATUS_LABEL[d.status] || d.status}
                            </span>
                          </td>
                          <td>
                            <div className="inline-form">
                              {d.status === "SCHEDULED" && (
                                <button type="button" className="btn btn-signal" disabled={locked} onClick={() => run(d, openDrop, "The drop is open. Fans can join now.")}>
                                  {busy ? "Opening..." : "Open"}
                                </button>
                              )}
                              {d.status === "OPEN" && (
                                <button type="button" className="btn btn-dark" disabled={locked} onClick={() => run(d, closeDrop, "The drop is closed. You can run the allocation now.")}>
                                  {busy ? "Closing..." : "Close"}
                                </button>
                              )}
                              {d.status === "CLOSED" && (
                                <button type="button" className="btn btn-signal" disabled={locked} onClick={() => run(d, startAllocation, "Allocation started. Winners are being picked.")}>
                                  {busy ? "Starting..." : "Run allocation"}
                                </button>
                              )}
                              {d.status === "ALLOCATING" && <span className="cell-sub">Working...</span>}
                              {["SCHEDULED", "OPEN", "CLOSED", "CANCELLED"].includes(d.status) && (
                                <button
                                  type="button"
                                  className="btn btn-light"
                                  disabled={locked}
                                  onClick={() => {
                                    if (window.confirm(`Delete "${d.name}"? This can't be undone.`)) run(d, deleteDrop, "The drop was deleted.");
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
