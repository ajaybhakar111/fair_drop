import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getUser, loginRequest, logoutRequest } from '../api/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = getUser();
  if (existing && existing.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = {};
    if (!email.trim()) errors.email = "Enter your admin email.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const res = await loginRequest({ email, password });
      if (res.data.user.role !== "ADMIN") {
        // Valid account, wrong role: don't leave them logged in
        await logoutRequest();
        setFormError("This account doesn't have admin access. Use the fan login instead.");
        setSubmitting(false);
        return;
      }
      navigate("/admin", { replace: true });
    } catch (err) {
      setFormError(
        err.code === "INVALID_CREDENTIALS"
          ? "That email and password don't match. Check them and try again."
          : err.code === "NETWORK_ERROR"
          ? "We can't reach the server. Check that the backend is running."
          : "We couldn't log you in right now. Try again in a moment."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Link to="/" className="brand">Fair Drop</Link>
        <div>
          <h1 className="auth-side-title">Control room access</h1>
          <p className="auth-side-text">
            Run drops, watch traffic and bot activity, and check that every allocation
            was fair. Admin accounts only.
          </p>
        </div>
        <p className="auth-side-foot">Fans log in at /login.</p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2 className="auth-title">Admin log in</h2>
          <p className="auth-sub">
            Not an admin? <Link to="/login">Go to fan login</Link>
          </p>

          {formError && (
            <div className="auth-error" role="alert">{formError}</div>
          )}

          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              placeholder="admin@example.com"
              disabled={submitting}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <div className="password-wrap">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                placeholder="Your password"
                disabled={submitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <button type="submit" className="btn btn-dark btn-wide" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>

          <div className="demo-box">
            <span>Demo admin: admin@example.com / Admin123!</span>
            <button
              type="button"
              className="link-btn"
              disabled={submitting}
              onClick={() => {
                setEmail("admin@example.com");
                setPassword("Admin123!");
                setFieldErrors({});
                setFormError("");
              }}
            >
              Fill it in
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}