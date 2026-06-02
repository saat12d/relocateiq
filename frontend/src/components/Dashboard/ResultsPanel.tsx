import React from "react";
import { neighborhoods } from "./data";

export default function ResultsPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="results-panel" aria-label="Top neighborhoods">
      <div className="panel-title-row">
        <div>
          <h1>Top neighborhoods</h1>
          <p>Ranked by total commute time</p>
        </div>
        <span>20 areas</span>
      </div>
      <div className="results-list">
        {neighborhoods.map((item) => (
          <button
            className={`result-card result-card--${item.tone} ${item.id === selectedId ? "is-selected" : ""}`}
            type="button"
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span className={`dashboard-rank dashboard-rank--${item.tone}`}>
              {item.rank}
            </span>
            <div className="result-card__body">
              <div className="result-card__headline">
                <strong>{item.name}</strong>
                <b>{item.drive} min</b>
              </div>
              <div className="result-card__metrics">
                <span>Drive {item.drive} min</span>
                <span>Transit {item.transit} min</span>
              </div>
              <div className="result-card__chips">
                <span>Walkability {item.walkability}</span>
                <span>Vibe {item.vibe}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button className="show-more-button" type="button">
        Show more neighborhoods
      </button>
    </aside>
  );
}
