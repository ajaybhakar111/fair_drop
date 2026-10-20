import React, { useEffect, useState } from "react";
import { fetchAbuseSignals } from "../api/admin";

const LIMIT = 10;
const POLL_MS = 5000;

const KIND_LABEL = { join: "Join rate limit exceeded" };

export default function AdminAbuse() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const pull = async (first) => {
      if (first) {
        setLoading(true);
        setError(false);
      }
      try {
        const r = await fetchAbuseSignals();
        if (!cancelled) {
          setData(r.data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled && first) setLoading(false);
      }
    };

    pull(true);
    const id = setInterval(() => pull(false), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [reloadKey]);

  const signals = data?.signals || [];
  const totalPages = Math.max(1, Math.ceil(signals.length / LIMIT));
  const safePage = Math.min(page, totalPages);
  const rows = signals.slice((safePage - 1) * LIMIT, safePage * LIMIT);

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Abuse monitor</h1>
          <p className="admin-sub">
            Clients that kept sending join requests after hitting the rate limit.
            {data && <span className="admin-updated"> {data.total} signals recorded</span>}
          </p>
        </div>
      </header>

      <div className="note-box">
        Counters expire after 15 minutes. Detection isn't perfect, and the draw stays fair even when a bot isn't caught,
        because every person gets one entry however many requests they send.
      </div>

      <section className="panel">
        {loading && (
          <div aria-busy="true" aria-label="Loading abuse signals">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10, marginBottom: 10 }} />
            ))}
          </div>
        )}

        {!loading && error && !data && (
          <div className="state-box" role="alert">
            <h2 className="state-title">Abuse signals didn't load</h2>
            <p className="state-text">Check that the backend and Redis are running, then try again.</p>
            <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
          </div>
        )}

        {!loading && !error && data && signals.length === 0 && (
          <div className="state-box">
            <h2 className="state-title">Nothing to show</h2>
            <p className="state-text">No clients have tripped the rate limit recently.</p>
          </div>
        )}

        {!loading && data && signals.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Drop</th>
                    <th>Signal</th>
                    <th>Times flagged</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>{a.userId}</td>
                      <td>{a.dropId}</td>
                      <td>
                        <span className="badge badge-neutral">{KIND_LABEL[a.kind] || a.kind}</span>
                      </td>
                      <td>{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button type="button" className="btn btn-light" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="pager-text">Page {safePage} of {totalPages}</span>
                <button type="button" className="btn btn-light" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}
