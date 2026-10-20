import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import FanHeader from './FanHeader'
import Countdown from "./Countdown";
import { getUser } from '../api/auth'
import * as api from '../api/drops'

const POLL_MS = 5000; // the live stream (SSE) handles results instantly; this catches open/close changes

const JOIN_ERRORS = {
  RATE_LIMITED: "Too many requests. Wait a few seconds, then try again.",
  ABUSE_DETECTED: "We need to double-check this request. Wait a moment, then try again.",
  SERVICE_UNAVAILABLE: "The service is busy right now. Try again in a moment.",
  NETWORK_ERROR: "We can't reach the server. Check your connection and try again.",
  REQUEST_BLOCKED: "Request temporarily blocked. We saw unusual activity from your connection. Try again in a few minutes.",
  DROP_CLOSED: "This drop closed before your entry went through.",
  ENTRY_WINDOW_CLOSED: "The entry window has closed for this drop.",
  DROP_NOT_OPEN: "This drop hasn't opened yet.",
  INTERNAL_ERROR: "Something went wrong on our side. Try again in a moment.",
};

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtNum = (n) => n.toLocaleString("en-IN");

/* ---------- The screen ---------- */
function DropScreen({ dropId, user }) {
  const [drop, setDrop] = useState(null);
  const [status, setStatus] = useState(null);
  const [entry, setEntry] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const keyRef = useRef(null); // one Idempotency-Key per join attempt, reused on retry

  // Refresh recovery: always rebuild the screen from the server answers
  const load = useCallback(
    async (silent) => {
      try {
        const [d, s, e] = await Promise.all([
          api.fetchDrop(dropId),
          api.fetchStatus(dropId),
          api
            .fetchMyEntry(dropId)
            .then((r) => r.data.entry)
            .catch((err) => {
              if (err.code === "ENTRY_NOT_FOUND") return null;
              throw err;
            }),
        ]);
        setDrop(d.data.drop);
        setStatus(s.data);
        setEntry(e);

        if (s.data.drop.status === "COMPLETED" && e) {
          const r = await api.fetchResult(dropId);
          setResult(r.data);
        } else {
          setResult(null);
        }
        setLoadError("");
      } catch (err) {
        // Session ended: always send the person to log in, even during background refreshes
        if (err.code === "AUTH_REQUIRED") setLoadError("AUTH_REQUIRED");
        else if (!silent) setLoadError(err.code || "INTERNAL_ERROR");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dropId]
  );

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  // Live updates: the SSE stream (/drops/:dropId/stream) pushes allocation and reservation events,
  // and a slow poll covers changes the stream doesn't announce (drop opening or closing)
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_MS);
    const closeStream = api.openDropStream(dropId, () => load(true));
    return () => {
      clearInterval(id);
      closeStream();
    };
  }, [dropId, load]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    setJoinError("");
    if (!keyRef.current) keyRef.current = newKey();

    try {
      const res = await api.joinDrop(dropId, keyRef.current);
      setEntry(res.data.entry);
      keyRef.current = null;
      await load(true);
    } catch (err) {
      if (err.code === "ALREADY_JOINED") {
        // Already in: that's a success, not an error
        keyRef.current = null;
        await load(true);
      } else {
        setJoinError(err.code || "INTERNAL_ERROR");
        if (["DROP_CLOSED", "ENTRY_WINDOW_CLOSED", "DROP_NOT_OPEN"].includes(err.code)) load(true);
      }
    } finally {
      setJoining(false);
    }
  };

  /* ----- Loading / error / not found ----- */
  if (loadError === "AUTH_REQUIRED") {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/drops/${dropId}`)}`} replace />;
  }

  if (loading) {
    return (
      <main className="fan-main">
        <div className="dp-grid" aria-busy="true" aria-label="Loading drop">
          <div className="skeleton dp-skel-main" />
          <div className="skeleton dp-skel-side" />
        </div>
      </main>
    );
  }

  if (loadError === "DROP_NOT_FOUND") {
    return (
      <main className="fan-main">
        <div className="state-box">
          <h2 className="state-title">We can't find that drop</h2>
          <p className="state-text">The link may be wrong, or the drop was removed.</p>
          <Link to="/events" className="btn btn-dark">Browse events</Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="fan-main">
        <div className="state-box" role="alert">
          <h2 className="state-title">The drop didn't load</h2>
          <p className="state-text">Your place is safe. Check your connection and try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => { setLoading(true); load(false); }}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const ds = status?.drop.status || drop.status;
  const joined = !!entry;

  /* ----- The state machine ----- */
  let stage;

  if (ds === "SCHEDULED") {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-wait">Not open yet</span>
        <h1 className="stage-title">This drop hasn't opened</h1>
        <p className="stage-text">Come back when the timer ends. Joining early isn't possible, and joining first doesn't help.</p>
        <Countdown to={drop.opensAt} label="Drop opens in" />
      </div>
    );
  } else if (ds === "OPEN" && !joined) {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-open">Open now</span>
        <h1 className="stage-title">Join the drop</h1>
        <p className="stage-text">
          Joining gives you one entry. Winners are picked at random after the drop closes, so there's no
          need to be first and no benefit in clicking again.
        </p>
        <Countdown to={drop.closesAt} label="Drop closes in" />

        {joinError && (
          <div className="auth-error" role="alert">
            {JOIN_ERRORS[joinError] || JOIN_ERRORS.INTERNAL_ERROR}
          </div>
        )}

        <button type="button" className="btn btn-signal btn-xl" onClick={handleJoin} disabled={joining}>
          {joining ? "Joining..." : joinError ? "Try again" : "Join drop"}
        </button>
      </div>
    );
  } else if (ds === "OPEN" && joined) {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-ok">You're in</span>
        <h1 className="stage-title">You're in the waiting room</h1>
        <p className="stage-text">
          Your entry is saved. You can refresh or close this tab and come back. Your place stays the same.
        </p>
        <Countdown to={drop.closesAt} label="Drop closes in" />
        <div className="live-stats">
          <div>
            <span className="live-num">{fmtNum(status.stats.eligibleEntries)}</span>
            <span className="live-label">people in the drop</span>
          </div>
          <div>
            <span className="live-num">{fmtNum(drop.ticketCount)}</span>
            <span className="live-label">tickets available</span>
          </div>
        </div>
      </div>
    );
  } else if (ds === "CLOSED") {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-wait">Drop closed</span>
        <h1 className="stage-title">Allocation in progress</h1>
        <p className="stage-text">
          {joined
            ? "Entries are closed. We're getting ready to pick winners. Keep this page open."
            : "Entries are closed. You didn't join this drop."}
        </p>
      </div>
    );
  } else if (ds === "ALLOCATING") {
    const p = status?.allocation?.progress ?? 0;
    stage = (
      <div className="stage">
        <span className="stage-tag tag-wait">Drawing now</span>
        <h1 className="stage-title">Selecting winners...</h1>
        <p className="stage-text">
          {joined ? "Every entry has the same chance. Your result will appear here." : "Winners are being picked from the people who joined."}
        </p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
          <div className="progress-fill" style={{ width: `${p}%` }} />
        </div>
        <span className="progress-text">{p}% complete</span>
      </div>
    );
  } else if (ds === "COMPLETED") {
    if (!joined) {
      stage = (
        <div className="stage">
          <span className="stage-tag tag-wait">Drop finished</span>
          <h1 className="stage-title">This drop has finished</h1>
          <p className="stage-text">You didn't join this drop, so there's no result for you. Look out for the next one.</p>
          <Link to="/events" className="btn btn-dark">Browse events</Link>
        </div>
      );
    } else if (result?.status === "SELECTED") {
      stage = (
        <div className="stage">
          <span className="stage-tag tag-ok">Selected</span>
          <h1 className="stage-title">You've been selected</h1>
          <p className="stage-text">A ticket is reserved for you. Confirm it before the timer ends or it goes back into the pool.</p>

          <div className="ticket-stub">
            <span className="ticket-label">Your ticket</span>
            <span className="ticket-number">{result.ticket.ticketNumber}</span>
          </div>

          <Countdown to={result.reservation.expiresAt} label="Reservation expires in" />

          <Link to={`/reservations/${result.reservationId}`} className="btn btn-signal btn-xl">
            Confirm my ticket
          </Link>
        </div>
      );
    } else if (result?.status === "NOT_SELECTED") {
      stage = (
        <div className="stage">
          <span className="stage-tag tag-wait">Result</span>
          <h1 className="stage-title">Not selected this time</h1>
          <p className="stage-text">
            There were far more entries than tickets, and winners were picked at random. Being turned down isn't
            about speed or clicks. You can join the next drop.
          </p>
          <Link to="/events" className="btn btn-dark">Browse other events</Link>
        </div>
      );
    } else {
      stage = (
        <div className="stage">
          <span className="stage-tag tag-wait">Result</span>
          <h1 className="stage-title">Checking your result...</h1>
        </div>
      );
    }
  } else {
    stage = (
      <div className="stage">
        <span className="stage-tag tag-bad">Cancelled</span>
        <h1 className="stage-title">This drop was cancelled</h1>
        <p className="stage-text">No tickets were allocated. Entries from this drop don't carry over.</p>
        <Link to="/events" className="btn btn-dark">Browse events</Link>
      </div>
    );
  }

  return (
    <main className="fan-main">
      <Link to={`/events/${drop.eventId}`} className="back-link">Back to event</Link>

      <div className="dp-grid">
        <section className="dp-main" aria-live="polite">{stage}</section>

        <aside className="dp-side" aria-label="Drop summary">
          <h2 className="dp-side-title">{drop.name}</h2>
          <dl className="dp-facts">
            <div><dt>Tickets</dt><dd>{drop.ticketCount}</dd></div>
            <div><dt>Opens</dt><dd>{fmtTime(drop.opensAt)}</dd></div>
            <div><dt>Closes</dt><dd>{fmtTime(drop.closesAt)}</dd></div>
          </dl>

          <div className="dp-entry">
            <span className="dp-entry-label">Your entry</span>
            {joined ? (
              <>
                <span className="entry-badge entry-yes">
                  {result?.status === "SELECTED" ? "Selected" : result?.status === "NOT_SELECTED" ? "Not selected" : "Eligible"}
                </span>
                <span className="dp-entry-time">Joined {fmtTime(entry.joinedAt)}</span>
              </>
            ) : (
              <span className="entry-badge entry-no">Not joined</span>
            )}
          </div>

          <p className="drop-note dp-rule">One entry per person. Extra clicks or requests never add extra chances.</p>
        </aside>
      </div>

    </main>
  );
}

/* ---------- Wrapper: login required ---------- */
export default function DropPage() {
  const { dropId } = useParams();
  const user = getUser();

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/drops/${dropId}`)}`} replace />;
  }

  return (
    <div className="fan-page">
      <FanHeader />
      <DropScreen key={dropId} dropId={dropId} user={user} />
    </div>
  );
}