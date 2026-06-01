import React from "react";
import "./Home.css";

const neighborhoods = [
  {
    rank: 1,
    name: "Highland Park",
    drive: "18 min",
    transit: "24 min",
    tone: "green",
  },
  {
    rank: 2,
    name: "Culver City",
    drive: "26 min",
    transit: "31 min",
    tone: "amber",
  },
  {
    rank: 3,
    name: "Silver Lake",
    drive: "31 min",
    transit: "34 min",
    tone: "gold",
  },
  {
    rank: 4,
    name: "Inglewood",
    drive: "42 min",
    transit: "49 min",
    tone: "red",
  },
];

export default function RankingPanel() {
  return (
    <aside className="ranking-card" aria-label="Top ranked neighborhoods">
      <div className="ranking-card__header">
        <strong>Top neighborhoods</strong>
        <span>20 areas</span>
      </div>
      <div className="ranking-list">
        {neighborhoods.map((item) => (
          <article className="ranking-item" key={item.name}>
            <span className={`rank-badge rank-badge--${item.tone}`}>
              {item.rank}
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>
                Drive {item.drive} / Transit {item.transit}
              </small>
            </div>
            <b className={`ranking-score ranking-score--${item.tone}`}>
              {item.drive}
            </b>
          </article>
        ))}
      </div>
    </aside>
  );
}
