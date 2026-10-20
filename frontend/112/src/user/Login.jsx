import React, { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getUser, loginRequest } from '../api/auth'

// Only allow redirects inside our own app
function safeRedirect(value) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/events";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in: skip the form
  const existing = getUser();
  if (existing) {
    return <Navigate to={existing.role === "ADMIN" ? "/admin" : redirectTo} replace />;
  }

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = "Enter your email.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email, like name@example.com.";
    if (!password) errors.password = "Enter your password.";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await loginRequest({ email, password });
      const role = res.data.user.role;
      navigate(role === "ADMIN" ? "/admin" : redirectTo, { replace: true });
    } catch (err) {
      if (err.code === "INVALID_CREDENTIALS") {
        setFormError("That email and password don't match. Check them and try again.");
      } else if (err.code === "RATE_LIMITED") {
        setFormError("Too many attempts. Wait a minute, then try again.");
      } else if (err.code === "NETWORK_ERROR") {
        setFormError("We can't reach the server. Check your connection and try again.");
      } else {
        setFormError("We couldn't log you in right now. Try again in a moment.");
      }
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setEmail("user@example.com");
    setPassword("Password123!");
    setFieldErrors({});
    setFormError("");
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Link to="/" className="brand">Fair Drop</Link>
        <div>
          <h1 className="auth-side-title">One person. One entry. A fair chance.</h1>
          <p className="auth-side-text">
            Log in to join a drop, keep your place if you refresh, and reserve your
            ticket if you're selected.
          </p>
        </div>
        <p className="auth-side-foot">500 seats. 50,000 people. Bots don't win.</p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2 className="auth-title">Log in</h2>
          <p className="auth-sub">
            New here? <Link to={`/register?redirect=${encodeURIComponent(redirectTo)}`}>Create an account</Link>
          </p>

          {params.get("redirect") && (
            <p className="auth-info">Log in to continue to your drop.</p>
          )}

          {formError && (
            <div className="auth-error" role="alert">
              {formError}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              placeholder="name@example.com"
              disabled={submitting}
            />
            {fieldErrors.email && (
              <span id="email-error" className="field-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
            {fieldErrors.password && (
              <span id="password-error" className="field-error">{fieldErrors.password}</span>
            )}
          </div>

          <button type="submit" className="btn btn-dark btn-wide" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>

          <div className="demo-box">
            <span>Demo account: user@example.com / Password123!</span>
            <button type="button" className="link-btn" onClick={fillDemo} disabled={submitting}>
              Fill it in
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}