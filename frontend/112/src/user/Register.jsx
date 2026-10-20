import React, { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getUser, registerRequest } from "../api/auth";

// Only allow redirects inside our own app
function safeRedirect(value) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/events";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = getUser();
  if (existing) {
    return <Navigate to={existing.role === "ADMIN" ? "/admin" : redirectTo} replace />;
  }

  const validate = () => {
    const errors = {};
    if (name.trim().length < 2) errors.name = "Enter your name (at least 2 characters).";
    if (!email.trim()) errors.email = "Enter your email.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email, like name@example.com.";
    if (!password) errors.password = "Choose a password.";
    else if (password.length < 8) errors.password = "Use at least 8 characters.";
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
      await registerRequest({ name, email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.code === "USER_ALREADY_EXISTS") {
        setFieldErrors({ email: "An account with this email already exists." });
      } else if (err.code === "VALIDATION_ERROR") {
        setFormError(err.message || "Check your details and try again.");
      } else if (err.code === "NETWORK_ERROR") {
        setFormError("We can't reach the server. Check your connection and try again.");
      } else {
        setFormError("We couldn't create your account right now. Try again in a moment.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Link to="/" className="brand">Fair Drop</Link>
        <div>
          <h1 className="auth-side-title">One person. One entry. A fair chance.</h1>
          <p className="auth-side-text">
            Create an account to join a drop, keep your place if you refresh, and reserve your
            ticket if you're selected.
          </p>
        </div>
        <p className="auth-side-foot">500 seats. 50,000 people. Bots don't win.</p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2 className="auth-title">Create account</h2>
          <p className="auth-sub">
            Already have one? <Link to={`/login?redirect=${encodeURIComponent(redirectTo)}`}>Log in</Link>
          </p>

          {formError && (
            <div className="auth-error" role="alert">
              {formError}
            </div>
          )}

          <div className="field">
            <label htmlFor="reg-name">Name</label>
            <input
              id="reg-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!fieldErrors.name}
              placeholder="Your name"
              disabled={submitting}
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              placeholder="name@example.com"
              disabled={submitting}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <div className="password-wrap">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                placeholder="At least 8 characters"
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
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>
      </main>
    </div>
  );
}
