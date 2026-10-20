import React, { useEffect, useState } from "react";
import { FAIRNESS_DROPS, fetchFairness } from './adminPages.mock' // no backend endpoint yet: demo data

const pct = (r) => (r * 100).toFixed(2) + "%";
const fmt = (n) => Number(n).toLocaleString("en-IN");

// Two-proportion z-test: is the gap between the two groups bigger than chance would explain?
function compare(a, b) {
  const p1 = a.allocations / a.participants;
  const p2 = b.allocations / b.participants;
  const pool = (a.allocations + b.allocations) / (a.participants + b.participants);
  const se = Math.sqrt(pool * (1 - pool) * (1 / a.participants + 1 / b.participants));
  return { diff: p1 - p2, z: se ? (p1 - p2) / se : 0 };
}

export default function AdminFairness() {
  const [dropId, setDropId] = useState(FAIRNESS_DROPS[0].id);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchFairness(dropId)
      .then((r) => !cancelled && setD(r.data))
      .catch((err) => !cancelled && setError(err.code || "INTERNAL_ERROR"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [dropId, reloadKey]);

  const low = d?.allocationGroups.lowRequestUsers;
  const high = d?.allocationGroups.highRequestUsers;
  const stats = d ? compare(low, high) : null;
  const maxRate = d ? Math.max(low.allocationRate, high.allocationRate) * 1.25 : 1;
  const clean = d && d.integrity.oversold === 0 && d.integrity.duplicateAllocations === 0;

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Fairness analysis</h1>
          <p className="admin-sub">Did sending more requests buy anyone a better chance?</p>
        </div>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="fair-drop">Drop</label>
          <select id="fair-drop" value={dropId} onChange={(e) => setDropId(e.target.value)}>
            {FAIRNESS_DROPS.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="note-box">
        Demo data. The backend has no fairness-analysis endpoint yet, so this page still reads from the built-in sample
        drops. Everything else in the control room is live.
      </div>

      {loading && (
        <div aria-busy="true" aria-label="Loading fairness data">
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton stat-skel" />
            ))}
          </div>
          <div className="skeleton panel-skel" />
        </div>
      )}

      {!loading && error && (
        <div className="state-box" role="alert">
          <h2 className="state-title">{error === "DROP_NOT_FOUND" ? "That drop doesn't exist" : "Fairness data didn't load"}</h2>
          <p className="state-text">Try again, or pick another drop.</p>
          <button type="button" className="btn btn-dark" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {!loading && !error && d && (
        <>
          <section className="integrity-row" aria-label="Integrity checks">
            <div className={`integrity-big ${d.integrity.oversold === 0 ? "" : "integrity-bad"}`}>
              <span className="integrity-num">{d.integrity.oversold}</span>
              <span className="integrity-label">Oversold</span>
              <span className={d.integrity.oversold === 0 ? "integrity-ok" : "integrity-fail"}>{d.integrity.oversold === 0 ? "Passing" : "Failing"}</span>
            </div>
            <div className={`integrity-big ${d.integrity.duplicateAllocations === 0 ? "" : "integrity-bad"}`}>
              <span className="integrity-num">{d.integrity.duplicateAllocations}</span>
              <span className="integrity-label">Duplicate allocations</span>
              <span className={d.integrity.duplicateAllocations === 0 ? "integrity-ok" : "integrity-fail"}>{d.integrity.duplicateAllocations === 0 ? "Passing" : "Failing"}</span>
            </div>
            <div className="integrity-big integrity-plain">
              <span className="integrity-num">{d.tickets.allocated}<small> / {d.tickets.total}</small></span>
              <span className="integrity-label">Tickets allocated</span>
              <span className="integrity-ok">{clean && d.tickets.allocated === d.tickets.total ? "Every ticket has one owner" : "Check allocation"}</span>
            </div>
          </section>

          <div className="admin-two">
            <section className="panel">
              <h2 className="panel-title">Allocation rate by request volume</h2>
              <p className="panel-sub">Share of each group that won a ticket</p>

              <div className="compare">
                {[
                  ["Low request users", low],
                  ["High request users", high],
                ].map(([label, g]) => (
                  <div key={label} className="compare-row">
                    <div className="compare-head">
                      <span className="compare-label">{label}</span>
                      <span className="compare-rate">{pct(g.allocationRate)}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(g.allocationRate / maxRate) * 100}%` }} />
                    </div>
                    <span className="cell-sub">{fmt(g.allocations)} winners from {fmt(g.participants)} people</span>
                  </div>
                ))}
              </div>

              <dl className="sys-list" style={{ marginTop: 20 }}>
                <div>
                  <dt>Gap between groups</dt>
                  <dd>{(stats.diff * 100).toFixed(3)} percentage points</dd>
                </div>
                <div>
                  <dt>z-score</dt>
                  <dd>{stats.z.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Detectable difference at 95%</dt>
                  <dd>{Math.abs(stats.z) < 1.96 ? "No" : "Yes, investigate"}</dd>
                </div>
              </dl>
            </section>

            <section className="panel">
              <h2 className="panel-title">Participants</h2>
              <p className="panel-sub">{fmt(d.participants.total)} people joined this drop</p>
              <dl className="sys-list">
                <div><dt>Normal behavior</dt><dd>{fmt(d.participants.normal)}</dd></div>
                <div><dt>Flagged as suspicious</dt><dd>{fmt(d.participants.suspicious)}</dd></div>
                <div><dt>Entries per person</dt><dd>1</dd></div>
              </dl>
            </section>
          </div>

          <div className="note-box">
            <strong>How to read this.</strong> The drop gives every person exactly one entry, so sending 1,000 requests
            still counts as one. If request volume doesn't help, the two groups should win at about the same rate, and a
            small gap should be explained by chance. This page measures one drop. One drop doesn't prove the system is
            fair, so repeat the check across many drops. A z-score between -1.96 and 1.96 means no difference could be
            detected. It doesn't prove none exists.
          </div>
        </>
      )}
    </main>
  );
}