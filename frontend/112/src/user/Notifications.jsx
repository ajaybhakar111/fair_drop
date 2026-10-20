import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import FanHeader from "./FanHeader";
import { getUser } from "../api/auth";
import { fetchNotifications, markNotificationRead } from "../api/notifications";

const LIMIT = 10;

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorCode("");
    fetchNotifications({ page, limit: LIMIT })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.notifications);
        setPagination(res.data.pagination);
        setUnreadCount(res.data.unreadCount);
      })
      .catch((err) => !cancelled && setErrorCode(err.code || "INTERNAL_ERROR"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const markRead = useCallback(async (id) => {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* leave it unread; the person can try again */
    } finally {
      setBusyId("");
    }
  }, []);

  if (errorCode === "AUTH_REQUIRED") {
    return <Navigate to={`/login?redirect=${encodeURIComponent("/notifications")}`} replace />;
  }

  return (
    <main className="fan-main">
      <section className="page-head">
        <h1 className="page-title">Notifications</h1>
        <p className="page-sub">
          {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."} Updates about your drops and tickets.
        </p>
      </section>

      {loading && (
        <div aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: 14, marginBottom: 12 }} />
          ))}
        </div>
      )}

      {!loading && errorCode && (
        <div className="state-box" role="alert">
          <h2 className="state-title">Notifications didn't load</h2>
          <p className="state-text">Check your connection and try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !errorCode && items.length === 0 && (
        <div className="state-box">
          <h2 className="state-title">No notifications yet</h2>
          <p className="state-text">We'll tell you here when a drop finishes or a reservation changes.</p>
        </div>
      )}

      {!loading && !errorCode && items.length > 0 && (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((n) => (
              <section key={n.id} className="panel">
                <div className="panel-row">
                  <div>
                    <h2 className="panel-title">
                      {n.title} {!n.isRead && <span className="badge badge-ok">New</span>}
                    </h2>
                    <p className="panel-sub">{n.message}</p>
                    <span className="cell-sub">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    {n.reservationId && n.type !== "RESERVATION_EXPIRED" && (
                      <Link to={`/reservations/${n.reservationId}`} className="panel-link">
                        Open reservation
                      </Link>
                    )}
                    {n.dropId && (
                      <Link to={`/drops/${n.dropId}`} className="panel-link">
                        View drop
                      </Link>
                    )}
                    {!n.isRead && (
                      <button type="button" className="link-btn" disabled={busyId === n.id} onClick={() => markRead(n.id)}>
                        {busyId === n.id ? "Saving..." : "Mark as read"}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button type="button" className="btn btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
  );
}

export default function Notifications() {
  const user = getUser();
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent("/notifications")}`} replace />;

  return (
    <div className="fan-page">
      <FanHeader />
      <NotificationsScreen />
    </div>
  );
}
