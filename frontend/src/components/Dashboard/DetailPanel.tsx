import React from "react";
import type { CommuteScenario } from "../models/types";
import { listings } from "./data";

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

// Extract the type of a single recommendation from the scenario type
type Recommendation = CommuteScenario["recommendations"][0];

export default function DetailPanel({
  selected,
}: {
  selected: Recommendation;
}) {
  const tone =
    selected.rank === 1 ? "green" : selected.rank <= 3 ? "amber" : "red";

  return (
    <aside className="zone-panel" aria-label={`${selected.zone.name} details`}>
      <div className={`zone-panel__header zone-panel__header--${tone}`}>
        <span className={`dashboard-rank dashboard-rank--${tone}`}>
          {selected.rank}
        </span>
        <div>
          <h2>{selected.zone.name}</h2>
          <p>
            <strong>{selected.commuteAnalysis.driveTimePeakMinutes} min</strong>{" "}
            total commute
          </p>
        </div>
        <button type="button" aria-label="Save neighborhood">
          ♡
        </button>
      </div>
      <section className="commute-summary" aria-label="Commute breakdown">
        <article>
          <small>Drive</small>
          <strong>{selected.commuteAnalysis.driveTimePeakMinutes} min</strong>
          <p>Peak congestion: {selected.commuteAnalysis.congestionLevel}</p>
        </article>
        <article>
          <small>Transit</small>
          <strong>{selected.commuteAnalysis.transitTimePeakMinutes} min</strong>
          <p>
            {selected.commuteAnalysis.transferCount} transfer
            {selected.commuteAnalysis.transferCount !== 1 ? "s" : ""}
          </p>
        </article>
      </section>
      <section className="score-panel">
        <div className="section-title">
          <h3>Lifestyle scores</h3>
          <a href="#scores">See all</a>
        </div>
        <ScoreBar
          label="Walkability"
          value={selected.lifestyleAnalysis.walkabilityScore}
        />
        <ScoreBar
          label="Groceries"
          value={selected.lifestyleAnalysis.groceryScore}
        />
        <ScoreBar label="Parks" value={selected.lifestyleAnalysis.parkScore} />
        <ScoreBar
          label="Nightlife"
          value={selected.lifestyleAnalysis.nightlifeScore}
        />
        <ScoreBar
          label="Quietness"
          value={selected.lifestyleAnalysis.quietnessScore}
        />
      </section>
      <section className="ai-panel">
        <div className="section-title">
          <h3>
            AI explanation <span>BETA</span>
          </h3>
          <b>✦</b>
        </div>
        {/* Render the actual AI explanation from the backend! */}
        <p>{selected.explanationSummary || "Generating insight..."}</p>
      </section>
      <section className="listing-panel">
        <div className="section-title">
          <h3>Listings in {selected.zone.name}</h3>
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
