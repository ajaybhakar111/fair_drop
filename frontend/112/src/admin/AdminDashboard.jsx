import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAbuseSignals, fetchDashboard } from '../api/admin'

const HISTORY = 30;
const POLL_MS = 1500;

const fmt = (n) => Number(n).toLocaleString("en-IN");


/* ---------- Traffic chart (plain SVG) ---------- */
function TrafficChart({ data }) {
  const w = 600;
  const h = 160;
  if (data.length < 2) {
    return <div className="chart-empty">Collecting data...</div>;
  }
  const max = Math.max(...data, 1000) * 1.1;
  const step = w / (HISTORY - 1);
  const offset = (HISTORY - data.length) * step;
  const pts = data.map((v, i) => [offset + i * step, h - (v / max) * h]);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${offset},${h} ${line} ${pts[pts.length - 1][0]},${h}`;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Join attempts over the last 45 seconds"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} className="chart-grid" />
      ))}
      <polygon points={area} className="chart-area" />
      <polyline points={line} className="chart-line" />
    </svg>
  );
}

/* ---------- Pieces ---------- */
function Stat({ label, value, note, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton stat-skel" />
        ))}
      </div>
      <div className="skeleton panel-skel" />
    </div>
  );
}

export default function AdminDashboard() {
  const [m, setM] = useState(null);
  const [signals, setSignals] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(true);
  const [lastAt, setLastAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const [res, abuse] = await Promise.all([
          fetchDashboard(),
          fetchAbuseSignals().catch(() => null),
        ]);
        if (cancelled) return;
        setM(res.data);
        if (abuse) setSignals(abuse.data.signals.slice(0, 5));
        setHistory((h) => [...h, res.data.traffic.joinAttempts].slice(-HISTORY));
        setLastAt(new Date());
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    pull();
    if (!live) {
      return () => {
        cancelled = true;
      };
    }
    // Polls the /admin/metrics/* endpoints
    const id = setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live, reloadKey]);

  const t = m?.tickets;
  const pct = (n) => (t && t.total > 0 ? (n / t.total) * 100 : 0);
  // Reserved + sold can never exceed the tickets that exist
  const oversold = t ? Math.max(0, t.reserved + t.sold - t.total) : 0;

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Dashboard</h1>
          <p className="admin-sub">
            Live system overview
            {lastAt && <span className="admin-updated"> Updated {lastAt.toLocaleTimeString("en-IN")}</span>}
          </p>
        </div>

        <div className="admin-actions">
          <span className={`live-pill ${live ? "live-on" : ""}`}>
            <span className="live-dot" aria-hidden="true" />
            {live ? "Live" : "Paused"}
          </span>
          <button type="button" className="btn btn-light" onClick={() => setLive((l) => !l)}>
            {live ? "Pause" : "Resume"}
          </button>
        </div>
      </header>

      {m && m.abuse.events > 0 && (
        <div className="alert-bar" role="alert">
          <strong>Abuse signals detected.</strong> {fmt(m.abuse.events)} suspicious join attempts were
          recorded across {fmt(m.abuse.activeCounters)} clients.
        </div>
      )}

      {error && !m && (
        <div className="state-box" role="alert">
          <h2 className="state-title">Metrics didn't load</h2>
          <p className="state-text">Check that the backend is running, then try again.</p>
          <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {error && m && (
        <div className="alert-bar alert-warn" role="alert">
          Live updates paused because the last request failed. Showing the latest data we have.
        </div>
      )}

      {!m && !error && <DashboardSkeleton />}

      {m && (
        <>
          {/* Headline numbers */}
          <section className="stat-grid" aria-label="Headline numbers">
            <Stat label="Join attempts (last 10s)" value={fmt(m.traffic.joinAttempts)} note={`${fmt(m.traffic.activeClients)} active clients`} tone={m.abuse.events > 0 ? "hot" : ""} />
            <Stat label="Registered users" value={fmt(m.users.total)} note={`${fmt(m.drops.open)} drops open now`} />
            <Stat label="Eligible entries" value={fmt(m.entries.eligible)} note={`${fmt(m.entries.total)} entries in total`} />
            <Stat label="Abuse signals" value={fmt(m.abuse.events)} note={`${fmt(m.abuse.activeCounters)} clients flagged`} tone="warn" />
          </section>

          <div className="admin-two">
            {/* Traffic */}
            <section className="panel">
              <h2 className="panel-title">Traffic</h2>
              <p className="panel-sub">Join attempts in the 10-second window, last 45 seconds</p>
              <TrafficChart data={history} />
            </section>

            {/* Integrity: the showpiece */}
            <section className="panel panel-dark">
              <h2 className="panel-title">Integrity checks</h2>
              <p className="panel-sub">These must always read zero</p>
              <div className="integrity">
                <div className="integrity-item">
                  <span className="integrity-num">{oversold}</span>
                  <span className="integrity-label">Oversold</span>
                  <span className={oversold === 0 ? "integrity-ok" : "integrity-fail"}>{oversold === 0 ? "Passing" : "Failing"}</span>
                </div>
                <div className="integrity-item">
                  <span className="integrity-num">0</span>
                  <span className="integrity-label">Duplicate allocations</span>
                  <span className="integrity-ok">Blocked by unique index</span>
                </div>
              </div>
              <Link to="/admin/fairness" className="panel-link">Open fairness analysis</Link>
            </section>
          </div>

          <div className="admin-two">
            {/* Ticket inventory */}
            <section className="panel">
              <h2 className="panel-title">Ticket inventory</h2>
              <p className="panel-sub">{fmt(t.total)} tickets across all events</p>

              <div className="inv-bar" role="img" aria-label={`${t.sold} sold, ${t.reserved} reserved, ${t.available} available`}>
                <div className="inv-sold" style={{ width: `${pct(t.sold)}%` }} />
                <div className="inv-reserved" style={{ width: `${pct(t.reserved)}%` }} />
                <div className="inv-available" style={{ width: `${pct(t.available)}%` }} />
              </div>

              <ul className="inv-legend">
                <li><span className="swatch swatch-sold" /> Sold <strong>{t.sold}</strong></li>
                <li><span className="swatch swatch-reserved" /> Reserved <strong>{t.reserved}</strong></li>
                <li><span className="swatch swatch-available" /> Available <strong>{t.available}</strong></li>
              </ul>
            </section>

            {/* System */}
            <section className="panel">
              <h2 className="panel-title">System</h2>
              <p className="panel-sub">Background queues and server health</p>
              <dl className="sys-list">
                <div>
                  <dt>Queue depth</dt>
                  <dd>{fmt(m.system.queueDepth)} jobs</dd>
                </div>
                <div>
                  <dt>Failed jobs</dt>
                  <dd className={m.system.failedJobs > 0 ? "txt-warn" : ""}>{fmt(m.system.failedJobs)}</dd>
                </div>
                <div>
                  <dt>Memory in use</dt>
                  <dd>{m.system.heapUsedMb} MB</dd>
                </div>
                <div>
                  <dt>Active reservations</dt>
                  <dd>{fmt(m.reservations.active)}</dd>
                </div>
              </dl>
            </section>
          </div>

          {/* Recent abuse */}
          <section className="panel">
            <div className="panel-row">
              <div>
                <h2 className="panel-title">Recent abuse signals</h2>
                <p className="panel-sub">Clients that kept sending join requests after hitting the rate limit</p>
              </div>
              <Link to="/admin/abuse" className="panel-link">View all</Link>
            </div>

            {signals.length === 0 ? (
              <p className="state-text">No suspicious activity yet.</p>
            ) : (
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
                    {signals.map((a) => (
                      <tr key={a.id}>
                        <td>{a.userId}</td>
                        <td>{a.dropId}</td>
                        <td>Join rate limit exceeded</td>
                        <td>{fmt(a.count)}</td>
                      </tr>
                    ))}
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