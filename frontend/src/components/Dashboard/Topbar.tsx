import React from "react";

export default function Topbar() {
  return (
    <header className="dashboard-topbar">
      <a className="dashboard-logo" href="/" aria-label="RelocateIQ home">
        <span>+</span>
        <strong>RelocateIQ</strong>
      </a>
      <label className="dashboard-search" htmlFor="dashboard-workplace">
        <span aria-hidden="true" />
        <input
          id="dashboard-workplace"
          defaultValue="800 Wilshire Blvd, Los Angeles"
        />
      </label>
      <div className="dashboard-radius">
        <small>Search radius</small>
        <strong>15 mi</strong>
      </div>
      <div className="mode-toggle" aria-label="Commute mode">
        <button className="is-active" type="button">
          Drive
        </button>
        <button type="button">Transit</button>
      </div>
      <label className="traffic-toggle">
        <input type="checkbox" defaultChecked readOnly />
        <span />
        Live traffic
      </label>
    </header>
  );
}
