import React, { useEffect, useState } from "react";
import { fetchHealth } from "../api/admin";

const POLL_MS = 5000;
const fmt = (n) => Number(n).toLocaleString("en-IN");

const QUEUES = [
  ["allocationQueue", "Allocation", "Picks the winners after a drop closes"],
  ["reservationQueue", "Reservation expiry", "Expires holds that weren't confirmed"],
];

const uptime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

function ServiceCard({ title, endpoint, h, detail }) {
  const good = h.status === "healthy";
  return (
    <div className={`health-card ${good ? "" : "health-card-bad"}`}>
      <div className="health-top">
        <span className="health-title">{title}</span>
        <span className={`badge ${good ? "badge-ok" : "badge-bad"}`}>{good ? "Healthy" : "Down"}</span>
      </div>
      <span className="health-detail">{good ? detail : "Not responding. Fans may see errors."}</span>
      <span className="cell-sub">GET {endpoint}</span>
    </div>
  );
}

export default function AdminHealth() {
  const [h, setH] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [auto, setAuto] = useState(true);
  const [lastAt, setLastAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const r = await fetchHealth();
        if (cancelled) return;
        setH(r.data);
        setLastAt(new Date());
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    pull();
    if (!auto) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auto, reloadKey]);

  const allGood = h && h.api.status === "healthy" && h.mongodb.status === "healthy" && h.redis.status === "healthy" && h.queues.status === "healthy";

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">System health</h1>
          <p className="admin-sub">
            {h ? (allGood ? "All systems are running normally." : "Something needs attention.") : "Checking systems..."}
            {lastAt && <span className="admin-updated"> Checked {lastAt.toLocaleTimeString("en-IN")}</span>}
          </p>
        </div>
        <div className="admin-actions">
          <button type="button" className="btn btn-light" onClick={() => setReloadKey((k) => k + 1)}>Check now</button>
          <button type="button" className="btn btn-light" onClick={() => setAuto((a) => !a)}>{auto ? "Pause auto-check" : "Resume auto-check"}</button>
        </div>
      </header>

      {loading && (
        <div className="health-grid" aria-busy="true" aria-label="Loading health">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 18 }} />
          ))}
        </div>
      )}

      {!loading && error && !h && (
        <div className="state-box" role="alert">
          <h2 className="state-title">Health checks didn't respond</h2>
          <p className="state-text">The API itself may be down. Try again in a moment.</p>
          <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {h && (
        <>
          {!allGood && (
            <div className="alert-bar" role="alert">
              <strong>Service problem.</strong> {h.redis.status !== "healthy" ? "Redis is down, so rate limiting, sessions and queues are affected. " : ""}
              Fans may see slow responses or errors until this is fixed.
            </div>
          )}

          <section className="health-grid" aria-label="Services">
            <ServiceCard title="API" endpoint="/health" h={h.api} detail={`Responding in ${h.api.latencyMs} ms, up ${uptime(h.api.uptimeSeconds)}, Node ${h.api.version}`} />
            <ServiceCard title="MongoDB" endpoint="/health/mongodb" h={h.mongodb} detail={`Responding in ${h.mongodb.latencyMs} ms`} />
            <ServiceCard title="Redis" endpoint="/health/redis" h={h.redis} detail={`Responding in ${h.redis.latencyMs} ms`} />
            <ServiceCard title="Queues" endpoint="/admin/metrics/queues" h={h.queues} detail="Both queues are reachable" />
          </section>

          <section className="panel">
            <h2 className="panel-title">Queues</h2>
            <p className="panel-sub">Background jobs waiting or running right now</p>

            {h.queues.status !== "healthy" ? (
              <div className="state-box">
                <h2 className="state-title">Queue data unavailable</h2>
                <p className="state-text">Queues run on Redis. They'll show up again when Redis is back.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Queue</th>
                      <th>Waiting</th>
                      <th>Active</th>
                      <th>Completed</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUEUES.map(([key, label, note]) => {
                      const c = h.queues[key];
                      return (
                        <tr key={key}>
                          <td>
                            <strong>{label}</strong>
                            <div className="cell-sub">{note}</div>
                          </td>
                          <td>{fmt((c.waiting || 0) + (c.delayed || 0))}</td>
                          <td>{fmt(c.active || 0)}</td>
                          <td>{fmt(c.completed || 0)}</td>
                          <td className={c.failed > 0 ? "txt-warn" : ""}>{fmt(c.failed || 0)}</td>
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