import React from "react";
import { Link } from "react-router-dom";
import type { CommuteScenario, HousingListing } from "../../models/types";

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

type DetailPanelProps = {
  selected: Recommendation;
  isExplaining: boolean;
  isSaved: boolean;
  isSaving: boolean;
  onSaveScenario: () => void;
  listings: HousingListing[];
  listingsStatus: "idle" | "loading" | "error";
};

export default function DetailPanel({
  selected,
  isExplaining,
  isSaved,
  isSaving,
  onSaveScenario,
  listings,
  listingsStatus,
}: DetailPanelProps) {
  const tone =
    selected.rank === 1 ? "green" : selected.rank <= 3 ? "amber" : "red";

  return (
    <aside className="zone-panel" aria-label={`${selected.zone.name} details`}>
      <div className={`zone-panel__header zone-panel__header--${tone}`}>
        <span className={`dashboard-rank dashboard-rank--${tone}`}>
          {selected.rank || "—"}
        </span>
        <div>
          <h2>{selected.zone.name}</h2>
          <p>
            <strong>{selected.commuteAnalysis.driveTimePeakMinutes} min</strong>{" "}
            total commute
          </p>
        </div>
        <button
          className="save-scenario-button"
          type="button"
          onClick={onSaveScenario}
          disabled={isSaved || isSaving}
          aria-label={isSaved ? "Scenario saved" : "Save scenario"}
        >
          {isSaving ? "Saving" : isSaved ? "Saved" : "Save"}
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
          <h3>AI explanation</h3>
          <b>✦</b>
        </div>

        {selected.explanationSummary ? (
          <p>{selected.explanationSummary}</p>
        ) : isExplaining ? (
          <p className="ai-panel__loading" role="status">
            Analyzing this neighborhood…
          </p>
        ) : (
          <p className="ai-panel__empty">
            Insights will appear here once analysis completes.
          </p>
        )}
      </section>

      <section className="listing-panel">
        <div className="section-title">
          <h3>Listings in {selected.zone.name}</h3>
        </div>
        <div className="listing-grid">
          {listingsStatus === "loading" ? (
            <p>Loading listings...</p>
          ) : listingsStatus === "error" ? (
            <p>Unable to load listings for this area.</p>
          ) : listings.length > 0 ? (
            listings.map((listing, index) => (
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
                <Link
                  to={`/zones/${selected.zone.zoneId}/listings/${listing.listingId}`}
                  className="listing-link"
                >
                  View Details
                </Link>
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
