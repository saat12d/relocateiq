import React from "react";
import type { CommuteScenario } from "../../models/types";

type ResultsPanelProps = {
  recommendations: CommuteScenario["recommendations"];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function ResultsPanel({
  recommendations,
  selectedId,
  onSelect,
}: ResultsPanelProps) {
  const getTone = (rank: number) => {
    if (rank === 1) return "green";
    if (rank <= 3) return "amber";
    return "red";
  };

  const matchingCount = recommendations.filter(
    (item) => item.meetsFilters,
  ).length;

  return (
    <aside className="results-panel" aria-label="Top neighborhoods">
      <div className="panel-title-row">
        <div>
          <h1>Top neighborhoods</h1>
          <p>Ranked by total commute time</p>
        </div>
        <span>{matchingCount} areas</span>
      </div>
      <div className="results-list">
        {recommendations.map((item) => {
          const dimmed = !item.meetsFilters;
          const tone = dimmed ? "muted" : getTone(item.rank);
          const isSelected = item.zone.zoneId === selectedId;

          return (
            <button
              className={`result-card result-card--${tone} ${isSelected ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""}`}
              type="button"
              key={item.zone.zoneId}
              onClick={() => onSelect(item.zone.zoneId)}
            >
              <span className={`dashboard-rank dashboard-rank--${tone}`}>
                {dimmed ? "—" : item.rank}
              </span>
              <div className="result-card__body">
                <div className="result-card__headline">
                  <strong>{item.zone.name}</strong>
                  <b>{item.commuteAnalysis.driveTimePeakMinutes} min</b>
                </div>
                <div className="result-card__metrics">
                  <span>
                    Drive {item.commuteAnalysis.driveTimePeakMinutes} min
                  </span>
                  <span>
                    Transit {item.commuteAnalysis.transitTimePeakMinutes} min
                  </span>
                </div>
                <div className="result-card__chips">
                  <span>
                    Walkability {item.lifestyleAnalysis.walkabilityScore}
                  </span>
                  <span>Quietness {item.lifestyleAnalysis.quietnessScore}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button className="show-more-button" type="button">
        Show more neighborhoods
      </button>
    </aside>
  );
}
