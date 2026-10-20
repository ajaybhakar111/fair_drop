import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSimulation, startSimulation, stopSimulation } from './adminPages.mock' // no backend endpoint yet: demo data

const ATTACKS = [
  ["BURST", "Burst", "Everyone fires at the same instant when the drop opens."],
  ["RETRY_STORM", "Retry storm", "Failed requests are retried again and again."],
  ["DUPLICATE_JOIN", "Duplicate join", "The same account sends many join requests."],
  ["HIGH_CONCURRENCY", "High concurrency", "Many requests from one client at once."],
  ["MIXED", "Mixed", "All of the above together."],
];

const STATUS_LABEL = { STARTING: "Starting", RUNNING: "Running", COMPLETED: "Completed", STOPPED: "Stopped", FAILED: "Failed" };
const DONE = ["COMPLETED", "STOPPED", "FAILED"];
const fmt = (n) => Number(n).toLocaleString("en-IN");

const DEFAULTS = { dropId: "drop_001", normalUsers: "10000", bots: "2000", botRequestsPerSecond: "500", durationSeconds: "60", attackType: "BURST" };

export default function AdminSimulation() {
  const [form, setForm] = useState(DEFAULTS);
  const [errors, setErrors] = useState({});
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [formError, setFormError] = useState("");

  const [simId, setSimId] = useState("");
  const [config, setConfig] = useState(null);
  const [sim, setSim] = useState(null);
  const [pollError, setPollError] = useState(false);

  const done = !!sim && DONE.includes(sim.status);
  const active = !!sim && !done;

  useEffect(() => {
    if (!simId || done) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const r = await fetchSimulation(simId);
        if (cancelled) return;
        setSim(r.data.simulation);
        setPollError(false);
      } catch {
        if (!cancelled) setPollError(true);
      }
    };
    pull();
    const id = setInterval(pull, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [simId, done]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleStart = async (e) => {
    e.preventDefault();
    if (starting || active) return;
    setStarting(true);
    setErrors({});
    setFormError("");
    const body = {
      dropId: form.dropId,
      normalUsers: Number(form.normalUsers),
      bots: Number(form.bots),
      botRequestsPerSecond: Number(form.botRequestsPerSecond),
      durationSeconds: Number(form.durationSeconds),
      attackType: form.attackType,
    };
    try {
      const r = await startSimulation(body);
      setConfig(body);
      setSim(null);
      setSimId(r.data.simulationId);
    } catch (err) {
      if (err.code === "VALIDATION_ERROR") setErrors(err.fields || {});
      else setFormError("The simulation couldn't start. Try again in a moment.");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (stopping || !simId) return;
    setStopping(true);
    try {
      await stopSimulation(simId);
      const r = await fetchSimulation(simId);
      setSim(r.data.simulation);
    } catch {
      setFormError("The simulation couldn't be stopped. Try again.");
    } finally {
      setStopping(false);
    }
  };

  const attack = ATTACKS.find((a) => a[0] === form.attackType);
  const locked = starting || active;

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Simulation</h1>
          <p className="admin-sub">Launch fake bot traffic and watch how the system handles it.</p>
        </div>
      </header>

      <div className="note-box">
        Demo data. The backend has no simulation endpoints yet, so this page runs a local simulation and sends no traffic
        to the API.
      </div>

      {formError && <div className="notice notice-error" role="alert">{formError}</div>}

      <div className="sim-grid">
        <section className="panel">
          <h2 className="panel-title">Attack settings</h2>
          <p className="panel-sub">Choose the crowd and the attack.</p>

          <form className="sim-form" onSubmit={handleStart} noValidate>
            <div className="field">
              <label htmlFor="sim-drop">Drop</label>
              <select id="sim-drop" value={form.dropId} onChange={setField("dropId")} disabled={locked}>
                <option value="drop_001">Mumbai Music Festival Ticket Drop</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="sim-type">Attack type</label>
              <select id="sim-type" value={form.attackType} onChange={setField("attackType")} disabled={locked}>
                {ATTACKS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <span className="cell-sub">{attack[2]}</span>
            </div>

            {[
              ["normalUsers", "Normal users"],
              ["bots", "Bots"],
              ["botRequestsPerSecond", "Bot requests per second"],
              ["durationSeconds", "Duration in seconds"],
            ].map(([name, label]) => (
              <div className="field" key={name}>
                <label htmlFor={`sim-${name}`}>{label}</label>
                <input id={`sim-${name}`} type="number" min="0" value={form[name]} onChange={setField(name)} aria-invalid={!!errors[name]} disabled={locked} />
                {errors[name] && <span className="field-error">{errors[name]}</span>}
              </div>
            ))}

            <button type="submit" className="btn btn-dark btn-wide" disabled={locked}>
              {starting ? "Starting..." : active ? "Simulation in progress" : "Start simulation"}
            </button>
          </form>
        </section>

        <section className="panel panel-dark">
          <div className="panel-row">
            <div>
              <h2 className="panel-title">Live results</h2>
              <p className="panel-sub">{config ? `${STATUS_LABEL[sim?.status] || "Starting"}: ${ATTACKS.find((a) => a[0] === config.attackType)[1]}` : "Nothing running yet"}</p>
            </div>
            {sim && <span className={`sim-pill sim-${sim.status.toLowerCase()}`}>{STATUS_LABEL[sim.status]}</span>}
          </div>

          {!simId && (
            <div className="sim-empty">
              <p>Set up an attack on the left and press Start. Requests per second, blocked and throttled counts will update here every second.</p>
            </div>
          )}

          {simId && !sim && !pollError && <div className="sim-empty"><p>Starting the simulation...</p></div>}

          {pollError && (
            <div className="alert-bar alert-warn" role="alert">Live updates paused because the last request failed. Retrying.</div>
          )}

          {sim && (
            <>
              <div className="progress progress-wide" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sim.progress}>
                <div className="progress-fill" style={{ width: `${sim.progress}%` }} />
              </div>
              <span className="sim-progress-text">{sim.progress}% complete</span>

              <div className="sim-stats">
                <div><span className="sim-num">{fmt(sim.traffic.requests)}</span><span className="sim-label">Total requests</span></div>
                <div><span className="sim-num">{fmt(sim.traffic.requestsPerSecond)}</span><span className="sim-label">Requests per second</span></div>
                <div><span className="sim-num">{fmt(sim.abuse.detected)}</span><span className="sim-label">Abuse detected</span></div>
                <div><span className="sim-num">{fmt(sim.abuse.throttled)}</span><span className="sim-label">Throttled</span></div>
                <div><span className="sim-num sim-num-hot">{fmt(sim.abuse.blocked)}</span><span className="sim-label">Blocked</span></div>
              </div>

              <div className="sim-actions">
                {active && (
                  <button type="button" className="btn sim-stop" onClick={handleStop} disabled={stopping}>
                    {stopping ? "Stopping..." : "Stop simulation"}
                  </button>
                )}
                {done && (
                  <Link to="/admin/fairness" className="panel-link">Check fairness for this drop</Link>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}