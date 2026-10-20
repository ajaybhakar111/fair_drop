import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getUser, logoutRequest } from "../api/auth";

export default function FanHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getUser());

  const handleLogout = async () => {
    await logoutRequest(); // POST /auth/logout clears the cookie
    setUser(null);
    navigate("/events");
  };

  return (
    <header className="fan-header">
      <div className="fan-header-inner">
        <Link to="/" className="brand">Fair Drop</Link>

        <nav className="fan-nav" aria-label="Main">
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/tickets">My tickets</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
        </nav>

        {user ? (
          <div className="header-user">
            <span className="header-name">{user.name}</span>
            <button type="button" className="btn btn-light" onClick={handleLogout}>
              Log out
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-dark">Log in</Link>
        )}
      </div>
    </header>
  );
}