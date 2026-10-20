import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import FanHeader from "./FanHeader";
import Countdown from "./Countdown";
import { getUser } from "../api/auth";
import { cancelReservation, confirmReservation, fetchReservation } from "../api/reservations";

const CONFIRM_ERRORS = {
  RESERVATION_EXPIRED: "This reservation ran out of time, so the ticket went back into the pool.",
  RESERVATION_NOT_ACTIVE: "This reservation can't be confirmed any more.",
  RESERVATION_CONFIRMED: "This ticket is already confirmed.",
  SERVICE_UNAVAILABLE: "The service is busy right now. Try again in a moment.",
  NETWORK_ERROR: "We can't reach the server. Check your connection and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Try again in a moment.",
};

const CANCEL_ERRORS = {
  RESERVATION_EXPIRED: "This reservation already expired, so the ticket returned to the pool.",
  RESERVATION_CONFIRMED: "This ticket has already been confirmed and cannot be declined.",
  RESERVATION_NOT_ACTIVE: "This reservation can't be cancelled anymore.",
  SERVICE_UNAVAILABLE: "The service is busy right now. Try again in a moment.",
  NETWORK_ERROR: "We can't reach the server. Check your connection and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Try again in a moment.",
};

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ReservationScreen({ reservationId }) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const keyRef = useRef(null); // one Idempotency-Key per confirm attempt, reused on retry
  const cancelKeyRef = useRef(null); // one Idempotency-Key per cancel attempt, reused on retry

  const load = useCallback(async () => {
    try {
      const res = await fetchReservation(reservationId);
      setReservation(res.data.reservation);
      setLoadError("");
    } catch (err) {
      setLoadError(err.code || "INTERNAL_ERROR");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setConfirmError("");
    if (!keyRef.current) keyRef.current = newKey();

    try {
      await confirmReservation(reservationId, keyRef.current);
      keyRef.current = null;
      await load();
    } catch (err) {
      if (err.code === "RESERVATION_EXPIRED") keyRef.current = null;
      setConfirmError(err.code || "INTERNAL_ERROR");
      if (err.code === "RESERVATION_EXPIRED" || err.code === "RESERVATION_NOT_ACTIVE") await load();
    } finally {
      setConfirming(false);
    }
  };

  const handleDecline = async () => {
    if (declining) return;
    setDeclining(true);
    setCancelError("");
    if (!cancelKeyRef.current) cancelKeyRef.current = newKey();

    try {
      await cancelReservation(reservationId, cancelKeyRef.current);
      cancelKeyRef.current = null;
      await load();
    } catch (err) {
      if (err.code === "RESERVATION_EXPIRED" || err.code === "RESERVATION_CONFIRMED") cancelKeyRef.current = null;
      setCancelError(err.code || "INTERNAL_ERROR");
      if (err.code === "RESERVATION_EXPIRED" || err.code === "RESERVATION_CONFIRMED") await load();
    } finally {
      setDeclining(false);
    }
  };

  if (loadError === "AUTH_REQUIRED") {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/reservations/${reservationId}`)}`} replace />;
  }

  if (loading) {
    return (
      <main className="fan-main">
        <div className="skeleton" style={{ height: 320, borderRadius: 18 }} aria-busy="true" aria-label="Loading reservation" />
      </main>
    );
  }

  if (loadError === "RESERVATION_NOT_FOUND") {
    return (
      <main className="fan-main">
        <div className="state-box">
          <h2 className="state-title">We can't find that reservation</h2>
          <p className="state-text">It may belong to another account, or the link is wrong.</p>
          <Link to="/tickets" className="btn btn-dark">My tickets</Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="fan-main">
        <div className="state-box" role="alert">
          <h2 className="state-title">The reservation didn't load</h2>
          <p className="state-text">Your ticket is safe. Check your connection and try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => { setLoading(true); load(); }}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const r = reservation;
  const dropLink = r.drop ? `/drops/${r.drop.id}` : "/events";

  let stage;
  if (r.status === "CONFIRMED") {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-ok">Confirmed</span>
        <h1 className="stage-title">Your ticket is confirmed</h1>
        <p className="stage-text">
          It's yours. {r.confirmedAt ? `Confirmed ${fmtDateTime(r.confirmedAt)}.` : ""} You can find it under My tickets.
        </p>
        <div className="ticket-stub">
          <span className="ticket-label">Your ticket</span>
          <span className="ticket-number">{r.ticket?.ticketNumber}</span>
        </div>
        <Link to="/tickets" className="btn btn-dark">View my tickets</Link>
      </div>
    );
  } else if (r.status === "ACTIVE") {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-open">Reserved</span>
        <h1 className="stage-title">Confirm your ticket</h1>
        <p className="stage-text">
          A ticket is held for you. Confirm it before the timer ends or decline it to release it back to the pool.
        </p>
        <div className="ticket-stub">
          <span className="ticket-label">Your ticket</span>
          <span className="ticket-number">{r.ticket?.ticketNumber}</span>
        </div>
        <Countdown to={r.expiresAt} label="Reservation expires in" />

        {confirmError && (
          <div className="auth-error" role="alert">
            {CONFIRM_ERRORS[confirmError] || CONFIRM_ERRORS.INTERNAL_ERROR}
          </div>
        )}

        {cancelError && (
          <div className="auth-error" role="alert">
            {CANCEL_ERRORS[cancelError] || CANCEL_ERRORS.INTERNAL_ERROR}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-signal btn-xl" onClick={handleConfirm} disabled={confirming || declining}>
            {confirming ? "Confirming..." : confirmError ? "Try again" : "Confirm my ticket"}
          </button>
          <button type="button" className="btn btn-dark btn-xl" onClick={handleDecline} disabled={confirming || declining}>
            {declining ? "Passing to next winner..." : cancelError ? "Try again" : "No thanks, pass this ticket to the next winner"}
          </button>
        </div>
      </div>
    );
  } else if (r.status === "CANCELLED") {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-bad">Cancelled</span>
        <h1 className="stage-title">This ticket was released</h1>
        <p className="stage-text">You chose not to accept this ticket, so it went back into the pool for someone else.</p>
        <Link to="/events" className="btn btn-dark">Browse events</Link>
      </div>
    );
  } else {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-bad">{r.status === "EXPIRED" ? "Expired" : "Cancelled"}</span>
        <h1 className="stage-title">
          {r.status === "EXPIRED" ? "This reservation expired" : "This reservation was cancelled"}
        </h1>
        <p className="stage-text">The ticket was released back into the pool.</p>
        <Link to="/events" className="btn btn-dark">Browse events</Link>
      </div>
    );
  }

  return (
    <main className="fan-main">
      <Link to={dropLink} className="back-link">Back to drop</Link>
      <div className="dp-grid">
        <section className="dp-main" aria-live="polite">{stage}</section>

        <aside className="dp-side" aria-label="Reservation summary">
          <h2 className="dp-side-title">{r.drop?.name || "Reservation"}</h2>
          <dl className="dp-facts">
            <div><dt>Ticket</dt><dd>{r.ticket?.ticketNumber || "-"}</dd></div>
            <div><dt>Status</dt><dd>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</dd></div>
            <div><dt>Expires</dt><dd>{fmtDateTime(r.expiresAt)}</dd></div>
          </dl>
          <p className="drop-note dp-rule">Confirming twice never charges or reserves a second ticket.</p>
        </aside>
      </div>
    </main>
  );
}

export default function Reservation() {
  const { reservationId } = useParams();
  const user = getUser();

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/reservations/${reservationId}`)}`} replace />;
  }

  return (
    <div className="fan-page">
      <FanHeader />
      <ReservationScreen key={reservationId} reservationId={reservationId} />
    </div>
  );
}
