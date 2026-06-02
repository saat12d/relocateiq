import React, { FormEvent } from "react";

type TopbarProps = {
  onSearch: (address: string) => void;
  isLoading: boolean;
};

export default function Topbar({ onSearch, isLoading }: TopbarProps) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const address = String(form.get("workplace"));

    if (address.trim()) {
      onSearch(address);
    }
  }

  return (
    <header className="dashboard-topbar">
      <a className="dashboard-logo" href="/" aria-label="RelocateIQ home">
        <span>+</span>
        <strong>RelocateIQ</strong>
      </a>

      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <label className="dashboard-search" htmlFor="dashboard-workplace">
          <span aria-hidden="true" />
          <input
            id="dashboard-workplace"
            name="workplace"
            placeholder="800 Wilshire Blvd, Los Angeles"
            disabled={isLoading}
          />
        </label>
        <button type="submit" style={{ display: "none" }}>
          Search
        </button>
      </form>

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
