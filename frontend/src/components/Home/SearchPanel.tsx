// [GenAI Use] Prompt: "How to connect a public React search component to a protected dashboard route, saving the query parameters so they execute after login?"
// [GenAI Use] LLM Response Start

import React, { ChangeEvent, useState } from "react";
import { useNavigate, createSearchParams } from "react-router-dom";
import "./Home.css";

// [GenAI Use] Prompt: "Role: React frontend engineer. 
// Context: The homepage radius slider should match the dashboard-supported radius options. 
// Task: change the radius control from a continuous 1-50 mile slider to preset values 
// of 5, 10, 15, 25, and 50 miles. 
// Criteria: keep 15 miles as the default and keep the displayed label in sync with the selected preset."
// [GenAI Use] LLM Response Start
const radiusOptions = [5, 10, 15, 25, 50];
const defaultRadiusIndex = 2;

export default function SearchPanel() {
  const [radiusIndex, setRadiusIndex] = useState(defaultRadiusIndex);
  const navigate = useNavigate();
  const radius = radiusOptions[radiusIndex];
  // [GenAI Use] LLM Response End
  // [GenAI Use] Reflection: We kept the preset approach because it matches dashboard/backend-supported 
  // radius choices and avoids having the continuous radius slider produce unsupported values the dashboard doesn't use.

  const [workplace, setWorkplace] = useState("");
  const navigate = useNavigate();

  const handleSearchSubmit = (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!workplace.trim()) return;
    navigate({
      pathname: "/dashboard",
      search: createSearchParams({
        workplace: workplace.trim(),
        radius: radius.toString(),
      }).toString(),
    });
  };

  return (
    <section className="hero-card" aria-labelledby="home-title" id="start">
      <p className="eyebrow">Smarter relocation by commute</p>
      <h1 id="home-title">Find the best place to live near your work.</h1>
      <p className="hero-copy">
        RelocateIQ ranks neighborhoods by commute, transit, walkability, and
        lifestyle fit before you open a single listing.
      </p>

      <form
        className="search-form"
        aria-label="Start a commute search"
        onSubmit={handleSearchSubmit}
      >
        <label htmlFor="workplace">Workplace address</label>
        <div className="address-field">
          <span aria-hidden="true" className="address-field__icon">
            +
          </span>
          <input
            id="workplace"
            type="text"
            placeholder="800 Wilshire Blvd, Los Angeles"
            onChange={(e) => setWorkplace(e.target.value)}
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
          <button className="button button--dark" type="submit">
            Start search
          </button>
        </div>
      </form>
    </section>
  );
}

// [GenAI Use] LLM Response End

// [GenAI Use] Reflection: it didn't edit much of the code, it just added a couple of lines,
// and the handleSearchSubmit function, but it had incorrect typing (for typescript), which
// i had to fix, since it was using depracated functions.
