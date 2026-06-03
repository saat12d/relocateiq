import React, { FormEvent } from "react";

import LogoutButton from "../Auth/LogoutButton";
import { useSession } from "../../hooks/useSession";

type TopbarProps = {
  onSearch: (address: string, radiusMiles: number) => void;
  isLoading: boolean;
  radiusMiles: number;
  onRadiusChange: (radiusMiles: number) => void;
};

const radiusOptions = [5, 10, 15, 25, 50];

export default function Topbar({
  onSearch,
  isLoading,
  radiusMiles,
  onRadiusChange,
}: TopbarProps) {
  const { user, logout } = useSession();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const address = String(form.get("workplace"));

    if (address.trim()) {
      onSearch(address, radiusMiles);
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
        <label htmlFor="dashboard-radius">Search radius</label>
        <select
          id="dashboard-radius"
          value={radiusMiles}
          disabled={isLoading}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        >
          {radiusOptions.map((option) => (
            <option key={option} value={option}>
              {option} mi
            </option>
          ))}
        </select>
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
      <div className="dashboard-session" aria-label="Account">
        {user && (
          <span className="dashboard-user-label" title={user.email}>
            {user.name}
          </span>
        )}
        <LogoutButton
          onLogout={logout}
          className="button button--ghost dashboard-logout"
        />
      </div>
    </header>
  );
}
