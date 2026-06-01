import React from "react";
import "./Header.css";

function Logo() {
  return (
    <a className="site-logo" href="/" aria-label="RelocateIQ home">
      <span className="site-logo__mark">+</span>
      <span>RelocateIQ</span>
    </a>
  );
}

export default function Header() {
  return (
    <header className="site-header">
      <Logo />
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#preview">Preview</a>
        <a href="#start">Start search</a>
      </nav>
      <div className="site-actions">
        <a className="button button--ghost" href="/login">
          Log in
        </a>
        <a className="button button--dark" href="/signup">
          Sign up
        </a>
      </div>
    </header>
  );
}
