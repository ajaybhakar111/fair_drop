import React from "react";
import { useNavigate } from "react-router-dom";

const ROLES = [
  {
    role: "USER",
    title: "I'm here for tickets",
    blurb: "Join a drop, wait for allocation, and reserve your seat if you're selected.",
    points: [
      "One entry per person, however many times you click",
      "Your place is saved if you refresh",
      "Reserved tickets are held until the timer ends",
    ],
    cta: "Continue as a fan",
    to: "/events",
  },
  {
    role: "ADMIN",
    title: "I run the drop",
    blurb: "Create events, control the drop, and watch how the system handles the crowd.",
    points: [
      "Live traffic and bot activity",
      "Allocation, oversold and duplicate checks",
      "Launch a bot attack simulation",
    ],
    cta: "Open control room",
    to: "/admin/login",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <main className="gate">
      <header className="gate-head">
        <span className="brand">Fair Drop</span>
        <h1 className="gate-title">500 seats. 50,000 people. Bots don't win.</h1>
        <p className="gate-sub">
          Every person gets exactly one entry. Sending more requests never
          improves your odds. Choose how you want to enter.
        </p>
      </header>

      <section className="gate-grid" aria-label="Choose your role">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            className={`role-card role-${r.role.toLowerCase()}`}
            onClick={() => navigate(r.to)}
          >
            <span className="role-tag">{r.role === "USER" ? "Fan" : "Admin"}</span>
            <h2 className="role-title">{r.title}</h2>
            <p className="role-blurb">{r.blurb}</p>

            <ul className="role-points">
              {r.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>

            <span className="role-cta">{r.cta}</span>
          </button>
        ))}
      </section>

      <footer className="gate-foot">
        <span className="dot" aria-hidden="true" />
        Connected to the live Fair Drop API.
      </footer>
    </main>
  );
}