import React, { useState } from "react";
import "./Home.css";

export default function SearchPanel() {
  const [radius, setRadius] = useState(15);

  return (
    <section className="hero-card" aria-labelledby="home-title" id="start">
      <p className="eyebrow">Smarter relocation by commute</p>
      <h1 id="home-title">Find the best place to live near your work.</h1>
      <p className="hero-copy">
        RelocateIQ ranks neighborhoods by commute, transit, walkability, and
        lifestyle fit before you open a single listing.
      </p>

      <form className="search-form" aria-label="Start a commute search">
        <label htmlFor="workplace">Workplace address</label>
        <div className="address-field">
          <span aria-hidden="true" className="address-field__icon">
            +
          </span>
          <input
            id="workplace"
            type="text"
            placeholder="800 Wilshire Blvd, Los Angeles"
          />
        </div>

        <div className="radius-row">
          <label htmlFor="radius">Search radius</label>
          <span>{radius} miles</span>
        </div>
        <input
          id="radius"
          className="radius-slider"
          type="range"
          min="1"
          max="50"
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
        />

        <div className="hero-actions">
          <button className="button button--dark" type="button">
            Start search
          </button>
          <a className="button button--light" href="#preview">
            View demo
          </a>
        </div>
      </form>
    </section>
  );
}
