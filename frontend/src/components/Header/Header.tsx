import React from "react";
import { Link } from "react-router-dom";

import LogoutButton from "../Auth/LogoutButton";
import { useSession } from "../../hooks/useSession";
import "./Header.css";

function Logo() {
  return (
    <Link className="site-logo" to="/" aria-label="RelocateIQ home">
      <span className="site-logo__mark">+</span>
      <span>RelocateIQ</span>
    </Link>
  );
}

export default function Header() {
  const { user, isLoading, isAuthenticated, logout } = useSession();

  return (
    <header className="site-header">
      <Logo />
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#preview">Preview</a>
        <a href="#start">Start search</a>
      </nav>
      <div className="site-actions">
        {isLoading ? (
          <span className="site-session-loading" aria-live="polite">
            …
          </span>
        ) : isAuthenticated && user ? (
          <>
            <span className="site-user-label" title={user.email}>
              {user.name}
            </span>
            <Link className="button button--ghost" to="/scenarios">
              Saved
            </Link>
            <Link className="button button--ghost" to="/dashboard">
              Dashboard
            </Link>
            <LogoutButton onLogout={logout} />
          </>
        ) : (
          <>
            <Link className="button button--ghost" to="/login">
              Log in
            </Link>
            <Link className="button button--dark" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
