import React from "react";
import { Neighborhood, listings } from "./data";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "green" : value >= 60 ? "amber" : "red";
  return (
    <div className="score-row">
      <span>{label}</span>
      <div className="score-track">
        <i
          className={`score-fill score-fill--${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <b>{value}</b>
    </div>
  );
}

export default function DetailPanel({ selected }: { selected: Neighborhood }) {
  return (
    <aside className="zone-panel" aria-label={`${selected.name} details`}>
      <div
        className={`zone-panel__header zone-panel__header--${selected.tone}`}
      >
        <span className={`dashboard-rank dashboard-rank--${selected.tone}`}>
          {selected.rank}
        </span>
        <div>
          <h2>{selected.name}</h2>
          <p>
            <strong>{selected.drive} min</strong> total commute
          </p>
        </div>
        <button type="button" aria-label="Save neighborhood">
          ♡
        </button>
      </div>
      <section className="commute-summary" aria-label="Commute breakdown">
        <article>
          <small>Drive</small>
          <strong>{selected.drive} min</strong>
          <p>12.4 miles</p>
        </article>
        <article>
          <small>Transit</small>
          <strong>{selected.transit} min</strong>
          <p>
            {selected.transfers} transfer{selected.transfers !== 1 ? "s" : ""}
          </p>
        </article>
      </section>
      <section className="score-panel">
        <div className="section-title">
          <h3>Lifestyle scores</h3>
          <a href="#scores">See all</a>
        </div>
        <ScoreBar label="Walkability" value={selected.walkability} />
        <ScoreBar label="Safety" value={selected.safety} />
        <ScoreBar label="Amenities" value={selected.amenities} />
        <ScoreBar label="Schools" value={selected.schools} />
      </section>
      <section className="ai-panel">
        <div className="section-title">
          <h3>
            AI explanation <span>BETA</span>
          </h3>
          <b>✦</b>
        </div>
        <p>{selected.summary}</p>
        <ul>
          <li>Strong commute fit compared with nearby neighborhoods</li>
          <li>Walkability and daily-life scores are already listing-ready</li>
        </ul>
      </section>
      <section className="listing-panel">
        <div className="section-title">
          <h3>Listings in {selected.name}</h3>
          <a href="#listings">View all</a>
        </div>
        <div className="listing-grid">
          {listings.map((listing, index) => (
            <article className="listing-card" key={listing.address}>
              <div className={`listing-photo listing-photo--${index + 1}`} />
              <strong>
                {listing.rent}
                <small>/mo</small>
              </strong>
              <p>{listing.meta}</p>
              <p>{listing.address}</p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
