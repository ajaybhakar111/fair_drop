import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FanHeader from './FanHeader'
import { fetchEvents } from "../api/events";

const LIMIT = 6;

const formatDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const monthDay = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IN", { month: "short" }),
  };
};

function EventCardSkeleton() {
  return (
    <div className="event-card skeleton-card" aria-hidden="true">
      <div className="event-poster skeleton" />
      <div className="event-body">
        <div className="skeleton skeleton-line w-70" />
        <div className="skeleton skeleton-line w-100" />
        <div className="skeleton skeleton-line w-40" />
      </div>
    </div>
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState(""); // "" = all, "ACTIVE" = active only
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchEvents({ page, limit: LIMIT, status: status || undefined })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.data.events);
        setPagination(res.data.pagination);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load events. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, status, reloadKey]);

  const changeFilter = (value) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="fan-page">
      <FanHeader />

      <main className="fan-main">
        <section className="page-head">
          <h1 className="page-title">Upcoming drops</h1>
          <p className="page-sub">
            Pick an event, log in, and join its drop. Everyone gets one entry.
          </p>
        </section>

        <div className="filter-row" role="group" aria-label="Filter events">
          <button
            type="button"
            className={`chip ${status === "" ? "chip-on" : ""}`}
            onClick={() => changeFilter("")}
          >
            All events
          </button>
          <button
            type="button"
            className={`chip ${status === "ACTIVE" ? "chip-on" : ""}`}
            onClick={() => changeFilter("ACTIVE")}
          >
            Active
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="event-grid" aria-busy="true" aria-label="Loading events">
            {Array.from({ length: LIMIT }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="state-box" role="alert">
            <h2 className="state-title">Events didn't load</h2>
            <p className="state-text">{error}</p>
            <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && events.length === 0 && (
          <div className="state-box">
            <h2 className="state-title">No events right now</h2>
            <p className="state-text">New drops are added often. Check back soon.</p>
            {status && (
              <button type="button" className="btn btn-dark" onClick={() => changeFilter("")}>
                Show all events
              </button>
            )}
          </div>
        )}

        {/* Events */}
        {!loading && !error && events.length > 0 && (
          <>
            <div className="event-grid">
              {events.map((e, i) => {
                const md = monthDay(e.date);
                const active = e.status === "ACTIVE";
                return (
                  <Link key={e.id} to={`/events/${e.id}`} className="event-card">
                    <div className={`event-poster poster-${i % 6}`}>
                      <div className="poster-date">
                        <span className="poster-day">{md.day}</span>
                        <span className="poster-month">{md.month}</span>
                      </div>
                      <span className={`status-pill ${active ? "pill-active" : "pill-ended"}`}>
                        {active ? "Active" : "Ended"}
                      </span>
                    </div>

                    <div className="event-body">
                      <h2 className="event-name">{e.name}</h2>
                      <p className="event-desc">{e.description}</p>
                      <dl className="event-meta">
                        <div>
                          <dt>Venue</dt>
                          <dd>{e.venue}</dd>
                        </div>
                        <div>
                          <dt>Starts</dt>
                          <dd>{formatDate(e.date)}, {e.startTime}</dd>
                        </div>
                        <div>
                          <dt>Seats</dt>
                          <dd>{e.totalTickets}</dd>
                        </div>
                      </dl>
                    </div>
                  </Link>
                );
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="pager-text">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}