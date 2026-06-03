import React from "react";
import type { CommuteScenario } from "../models/types";

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

type Recommendation = CommuteScenario["recommendations"][0];

// Update the props interface to include the new functions
type DetailPanelProps = {
  selected: Recommendation;
  isGenerating: boolean;
  onGenerateInsight: () => void;
};

export default function DetailPanel({
  selected,
  isGenerating,
  onGenerateInsight,
}: DetailPanelProps) {
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

        {selected.explanationSummary ? (
          <p>{selected.explanationSummary}</p>
        ) : (
          <button
            className="generate-ai-button"
            type="button"
            onClick={onGenerateInsight}
            disabled={isGenerating}
          >
            {isGenerating ? "Analyzing neighborhood..." : "Generate Insights"}
          </button>
        )}
      </section>

      <section className="listing-panel">
        <div className="section-title">
          <h3>Listings in {selected.zone.name}</h3>
          <a href="#listings">View all</a>
        </div>
        <div className="listing-grid">
          {selected.listings && selected.listings.length > 0 ? (
            selected.listings.map((listing, index) => (
              <article className="listing-card" key={listing.listingId}>
                <div
                  className={`listing-photo listing-photo--${(index % 3) + 1}`}
                />
                <strong>
                  ${listing.rent}
                  <small>/mo</small>
                </strong>
                <p>
                  {listing.bedrooms} bed • {listing.bathrooms} bath
                </p>
                <p>{listing.address}</p>
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noreferrer"
                  className="listing-link"
                >
                  View Details
                </a>
              </article>
            ))
          ) : (
            <p>No listings found for this area.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
