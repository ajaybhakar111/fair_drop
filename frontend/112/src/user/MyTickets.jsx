import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import FanHeader from "./FanHeader";
import Countdown from "./Countdown";
import { getUser } from "../api/auth";
import { fetchMyTickets } from "../api/tickets";

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function TicketsScreen() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorCode("");
    fetchMyTickets()
      .then((res) => !cancelled && setTickets(res.data.tickets))
      .catch((err) => !cancelled && setErrorCode(err.code || "INTERNAL_ERROR"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (errorCode === "AUTH_REQUIRED") {
    return <Navigate to={`/login?redirect=${encodeURIComponent("/tickets")}`} replace />;
  }

  return (
    <main className="fan-main">
      <section className="page-head">
        <h1 className="page-title">My tickets</h1>
        <p className="page-sub">Tickets you've reserved or confirmed. Confirm a reserved ticket before its timer ends.</p>
      </section>

      {loading && (
        <div aria-busy="true" aria-label="Loading tickets">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 130, borderRadius: 18, marginBottom: 14 }} />
          ))}
        </div>
      )}

      {!loading && errorCode && (
        <div className="state-box" role="alert">
          <h2 className="state-title">Tickets didn't load</h2>
          <p className="state-text">Check your connection and try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !errorCode && tickets.length === 0 && (
        <div className="state-box">
          <h2 className="state-title">No tickets yet</h2>
          <p className="state-text">Join a drop. If you're selected, your ticket shows up here.</p>
          <Link to="/events" className="btn btn-dark">Browse events</Link>
        </div>
      )}

      {!loading && !errorCode && tickets.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {tickets.map((t) => {
            const confirmed = t.reservation.status === "CONFIRMED";
            return (
              <section key={t.ticketId} className="panel">
                <div className="panel-row">
                  <div>
                    <h2 className="panel-title">{t.drop?.name || "Ticket"}</h2>
                    <p className="panel-sub">
                      {confirmed
                        ? `Confirmed ${t.reservation.confirmedAt ? fmtDateTime(t.reservation.confirmedAt) : ""}`
                        : `Reserved until ${fmtDateTime(t.reservation.expiresAt)}`}
                    </p>
                  </div>
                  <span className={`badge ${confirmed ? "badge-ok" : "badge-neutral"}`}>
                    {confirmed ? "Confirmed" : "Reserved"}
                  </span>
                </div>

                <div className="ticket-stub">
                  <span className="ticket-label">Ticket number</span>
                  <span className="ticket-number">{t.ticketNumber}</span>
                </div>

                {!confirmed && (
                  <>
                    <Countdown to={t.reservation.expiresAt} label="Reservation expires in" />
                    <Link to={`/reservations/${t.reservation.reservationId}`} className="btn btn-signal btn-wide">
                      Confirm my ticket
                    </Link>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function MyTickets() {
  const user = getUser();
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent("/tickets")}`} replace />;

  return (
    <div className="fan-page">
      <FanHeader />
      <TicketsScreen />
    </div>
  );
}
