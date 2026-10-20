import React, { useEffect, useState } from "react";
import { createEvent, fetchAdminEvents, generateTickets } from '../api/admin'

const EMPTY = { name: "", description: "", venue: "", date: "", startTime: "", totalTickets: "" };

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState(null); // { type: "ok" | "error", text }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchAdminEvents()
      .then((r) => !cancelled && setEvents(r.data.events))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setErrors({});
    setNotice(null);
    try {
      const res = await createEvent({ ...form, totalTickets: form.totalTickets === "" ? NaN : Number(form.totalTickets) });
      setEvents((list) => [res.data.event, ...list]);
      setForm(EMPTY);
      setNotice({ type: "ok", text: `"${res.data.event.name}" was created. Next, generate its tickets.` });
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && err.fields) setErrors(err.fields);
      else if (err.code === "AUTH_REQUIRED" || err.code === "FORBIDDEN")
        setNotice({ type: "error", text: "Your admin session ended. Log in again to continue." });
      else
        setNotice({
          type: "error",
          text: `The event couldn't be created${err.message && err.message !== err.code ? `: ${err.message}` : ""}.`,
        });
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async (ev) => {
    if (busyId) return;
    setBusyId(ev.id);
    setNotice(null);
    try {
      // The backend creates one ticket for every seat in a single call
      const res = await generateTickets(ev.id);
      setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, ticketsGenerated: res.data.created } : x)));
      setNotice({ type: "ok", text: `${res.data.created} tickets generated for ${ev.name}. Every ticket has a unique number.` });
    } catch (err) {
      setNotice({
        type: "error",
        text: err.fields?.quantity || "Tickets couldn't be generated. Try again in a moment.",
      });
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Events and tickets</h1>
          <p className="admin-sub">Create an event, then generate the tickets that a drop will hand out.</p>
        </div>
      </header>

      {notice && (
        <div className={notice.type === "ok" ? "notice notice-ok" : "notice notice-error"} role="status">
          {notice.text}
        </div>
      )}

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2 className="panel-title">New event</h2>
        <p className="panel-sub">Fans will see this on the events page.</p>

        <form className="form-grid" onSubmit={handleCreate} noValidate>
          <div className="field">
            <label htmlFor="ev-name">Event name</label>
            <input id="ev-name" value={form.name} onChange={setField("name")} aria-invalid={!!errors.name} placeholder="Mumbai Music Festival" disabled={creating} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="ev-venue">Venue</label>
            <input id="ev-venue" value={form.venue} onChange={setField("venue")} aria-invalid={!!errors.venue} placeholder="Mumbai" disabled={creating} />
            {errors.venue && <span className="field-error">{errors.venue}</span>}
          </div>

          <div className="field">
            <label htmlFor="ev-date">Date</label>
            <input id="ev-date" type="date" value={form.date} onChange={setField("date")} aria-invalid={!!errors.date} disabled={creating} />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </div>

          <div className="field">
            <label htmlFor="ev-time">Start time</label>
            <input id="ev-time" type="time" value={form.startTime} onChange={setField("startTime")} aria-invalid={!!errors.startTime} disabled={creating} />
            {errors.startTime && <span className="field-error">{errors.startTime}</span>}
          </div>

          <div className="field">
            <label htmlFor="ev-total">Total tickets</label>
            <input id="ev-total" type="number" min="1" value={form.totalTickets} onChange={setField("totalTickets")} aria-invalid={!!errors.totalTickets} placeholder="500" disabled={creating} />
            {errors.totalTickets && <span className="field-error">{errors.totalTickets}</span>}
          </div>

          <div className="field">
            <label htmlFor="ev-desc">Description (optional)</label>
            <input id="ev-desc" value={form.description} onChange={setField("description")} placeholder="Live music experience" disabled={creating} />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-dark" disabled={creating}>
              {creating ? "Creating event..." : "Create event"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">All events</h2>
        <p className="panel-sub">Generate tickets once per event. One ticket is created for every seat.</p>

        {loading && (
          <div aria-busy="true" aria-label="Loading events">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="state-box" role="alert">
            <h2 className="state-title">Events didn't load</h2>
            <p className="state-text">Check that the backend is running, then try again.</p>
            <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="state-box">
            <h2 className="state-title">No events yet</h2>
            <p className="state-text">Create your first event with the form above.</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Tickets generated</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const remaining = ev.totalTickets - ev.ticketsGenerated;
                  const full = remaining === 0;
                  const busy = busyId === ev.id;
                  return (
                    <tr key={ev.id}>
                      <td>
                        <strong>{ev.name}</strong>
                        <div className="cell-sub">{ev.venue}</div>
                      </td>
                      <td>{fmtDate(ev.date)}, {ev.startTime}</td>
                      <td>
                        {ev.ticketsGenerated} of {ev.totalTickets}{" "}
                        {full && <span className="badge badge-ok">All generated</span>}
                      </td>
                      <td>
                        <div className="inline-form">
                          <button type="button" className="btn btn-light" disabled={full || !!busyId} onClick={() => handleGenerate(ev)}>
                            {busy ? "Generating..." : full ? "Generated" : "Generate all tickets"}
                          </button>
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
    </main>
  );
}