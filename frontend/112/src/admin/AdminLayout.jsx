import React, { useEffect } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { fetchMe, getUser, logoutRequest } from '../api/auth'

const NAV = [
  { label: "Dashboard", to: "/admin", end: true },
  { label: "Events and tickets", to: "/admin/events" },
  { label: "Drops", to: "/admin/drops" },
  { label: "Abuse monitor", to: "/admin/abuse" },
  { label: "Fairness", to: "/admin/fairness" },
  { label: "Simulation", to: "/admin/simulation" },
  { label: "System health", to: "/admin/health" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getUser();

  // The cached user is only a hint. Ask the server whether the cookie is still valid.
  useEffect(() => {
    if (!user) return;
    fetchMe()
      .then((fresh) => {
        if (fresh.role !== "ADMIN") navigate("/admin/login", { replace: true });
      })
      .catch((err) => {
        if (err.code === "AUTH_REQUIRED") navigate("/admin/login", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await logoutRequest(); // POST /auth/logout clears the cookie
    navigate("/admin/login");
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand">Fair Drop</span>
          <span className="admin-brand-sub">Control room</span>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-user">
          <span className="admin-user-name">{user.name}</span>
          <span className="admin-user-role">Administrator</span>
          <button type="button" className="admin-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}