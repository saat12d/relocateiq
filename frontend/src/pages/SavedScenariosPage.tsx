import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./SavedScenariosPage.css";

type SavedScenario = {
  id: string;
  workplace: string;
  createdAt: string;
  radiusMiles: number;
  topNeighborhood: string;
  recommendationCount: number;
  driveMinutes: number;
  transitMinutes: number;
  insightState: "AI insights added" | "Needs insights";
  zones: Array<{
    rank: number;
    tone: "green" | "amber" | "red";
    x: number;
    y: number;
  }>;
};

const savedScenarios: SavedScenario[] = [
  {
    id: "scenario-dtla",
    workplace: "800 Wilshire Blvd, Los Angeles",
    createdAt: "June 2, 2026",
    radiusMiles: 15,
    topNeighborhood: "Downtown LA",
    recommendationCount: 19,
    driveMinutes: 8,
    transitMinutes: 9,
    insightState: "AI insights added",
    zones: [
      { rank: 1, tone: "green", x: 64, y: 34 },
      { rank: 2, tone: "amber", x: 33, y: 66 },
      { rank: 3, tone: "amber", x: 40, y: 27 },
      { rank: 4, tone: "red", x: 72, y: 72 },
    ],
  },
  {
    id: "scenario-ucla",
    workplace: "UCLA, Los Angeles",
    createdAt: "June 1, 2026",
    radiusMiles: 10,
    topNeighborhood: "Westwood",
    recommendationCount: 8,
    driveMinutes: 6,
    transitMinutes: 12,
    insightState: "Needs insights",
    zones: [
      { rank: 1, tone: "green", x: 52, y: 38 },
      { rank: 2, tone: "amber", x: 70, y: 55 },
      { rank: 3, tone: "amber", x: 30, y: 45 },
    ],
  },
  {
    id: "scenario-sm",
    workplace: "Santa Monica Pier",
    createdAt: "May 30, 2026",
    radiusMiles: 25,
    topNeighborhood: "Santa Monica",
    recommendationCount: 14,
    driveMinutes: 10,
    transitMinutes: 18,
    insightState: "AI insights added",
    zones: [
      { rank: 1, tone: "green", x: 35, y: 30 },
      { rank: 2, tone: "amber", x: 56, y: 48 },
      { rank: 3, tone: "amber", x: 72, y: 28 },
      { rank: 4, tone: "red", x: 65, y: 72 },
    ],
  },
];

function MiniScenarioMap({ scenario }: { scenario: SavedScenario }) {
  const topZone = scenario.zones[0];

  return (
    <svg
      className="scenario-mini-map"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Mini map preview for ${scenario.workplace}`}
    >
      <defs>
        <pattern id={`${scenario.id}-grid`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(33,28,24,0.09)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${scenario.id}-grid)`} />
      <path className="scenario-mini-road scenario-mini-road--one" d="M4 72 C20 63 31 57 45 50 S73 36 96 24" />
      <path className="scenario-mini-road scenario-mini-road--two" d="M18 8 C30 29 45 41 59 50 S81 72 94 92" />
      <circle className="scenario-mini-radius" cx="50" cy="52" r="34" />
      {scenario.zones.map((zone) => (
        <g key={zone.rank}>
          <path
            className={`scenario-mini-zone scenario-mini-zone--${zone.tone}`}
            d={`M ${zone.x - 11} ${zone.y - 3} C ${zone.x - 8} ${zone.y - 15}, ${zone.x + 8} ${zone.y - 13}, ${zone.x + 12} ${zone.y - 2} C ${zone.x + 15} ${zone.y + 9}, ${zone.x - 7} ${zone.y + 14}, ${zone.x - 13} ${zone.y + 4} Z`}
          />
          <circle className={`scenario-mini-pin scenario-mini-pin--${zone.tone}`} cx={zone.x} cy={zone.y} r={7} />
          <text x={zone.x} y={zone.y + 4}>{zone.rank}</text>
        </g>
      ))}
      <path
        className="scenario-mini-route"
        d={`M 50 52 C ${(50 + topZone.x) / 2 - 8} ${(52 + topZone.y) / 2}, ${(50 + topZone.x) / 2 + 8} ${(52 + topZone.y) / 2}, ${topZone.x} ${topZone.y}`}
      />
      <circle className="scenario-mini-workplace" cx="50" cy="52" r="8" />
    </svg>
  );
}

function ScenarioCard({ scenario }: { scenario: SavedScenario }) {
  return (
    <article className="scenario-card">
      <MiniScenarioMap scenario={scenario} />
      <div className="scenario-card__body">
        <div className="scenario-card__header">
          <div>
            <p>{scenario.createdAt}</p>
            <h2>{scenario.workplace}</h2>
          </div>
          <button type="button" aria-label="Scenario actions">...</button>
        </div>

        <div className="scenario-card__summary">
          <span>{scenario.radiusMiles} mi radius</span>
          <span>{scenario.recommendationCount} areas</span>
          <span>{scenario.insightState}</span>
        </div>

        <div className="scenario-card__rank">
          <span>1</span>
          <div>
            <small>Top match</small>
            <strong>{scenario.topNeighborhood}</strong>
          </div>
        </div>

        <dl className="scenario-card__metrics">
          <div>
            <dt>Drive</dt>
            <dd>{scenario.driveMinutes} min</dd>
          </div>
          <div>
            <dt>Transit</dt>
            <dd>{scenario.transitMinutes} min</dd>
          </div>
        </dl>

        <Link className="scenario-card__open" to={`/dashboard?scenarioId=${scenario.id}`}>
          Open scenario
        </Link>
      </div>
    </article>
  );
}

export default function SavedScenariosPage() {
  const [query, setQuery] = useState("");

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedScenarios;
    return savedScenarios.filter((scenario) =>
      [scenario.workplace, scenario.topNeighborhood]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  return (
    <main className="saved-scenarios-page">
      <section className="saved-scenarios-hero">
        <div>
          <p className="saved-scenarios-eyebrow">Scenario library</p>
          <h1>Saved scenarios</h1>
          <p>
            Reopen commute searches, compare ranked neighborhoods, and continue from the same filters.
          </p>
        </div>
        <Link className="saved-scenarios-primary" to="/dashboard">
          Start a search
        </Link>
      </section>

      <section className="saved-scenarios-toolbar" aria-label="Saved scenario filters">
        <label htmlFor="scenario-search">Search</label>
        <input
          id="scenario-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Workplace or neighborhood"
        />
        <select defaultValue="recent" aria-label="Sort scenarios">
          <option value="recent">Most recent</option>
          <option value="radius">Radius</option>
          <option value="drive">Shortest drive</option>
        </select>
      </section>

      {filteredScenarios.length > 0 ? (
        <section className="scenario-grid" aria-label="Saved scenarios">
          {filteredScenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </section>
      ) : (
        <section className="saved-scenarios-empty">
          <h2>No saved scenarios found</h2>
          <p>Try a different search or start a new commute scenario.</p>
          <Link to="/dashboard">Start a search</Link>
        </section>
      )}
    </main>
  );
}
