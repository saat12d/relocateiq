import React, { useState } from "react";
import "./Home.css";

const radiusOptions = [5, 10, 15, 25, 50];
const defaultRadiusIndex = 2;

export default function SearchPanel() {
  const [radiusIndex, setRadiusIndex] = useState(defaultRadiusIndex);
  const radius = radiusOptions[radiusIndex];

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
          min="0"
          max={radiusOptions.length - 1}
          step="1"
          value={radiusIndex}
          onChange={(event) => setRadiusIndex(Number(event.target.value))}
        />

        <div className="hero-actions">
          <button className="button button--dark" type="button">
            Start search
          </button>
        </div>
      </form>
    </section>
  );
}
