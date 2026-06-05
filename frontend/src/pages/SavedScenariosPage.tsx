import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CommuteScenario } from "../models/types";
import { fetchSavedScenarios } from "../services/scenario";
import { withRequirements, userSignedInRequirement } from "../lib/Requirements";
import "./SavedScenariosPage.css";

type SavedScenarioZone = {
  rank: number;
  tone: "green" | "amber" | "red";
  x: number;
  y: number;
};

const previewPositions: Array<Pick<SavedScenarioZone, "x" | "y">> = [
  { x: 64, y: 34 },
  { x: 33, y: 66 },
  { x: 40, y: 27 },
  { x: 72, y: 72 },
];

function getRankTone(rank: number): SavedScenarioZone["tone"] {
  if (rank === 1) return "green";
  if (rank <= 3) return "amber";
  return "red";
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getPreviewZones(scenario: CommuteScenario): SavedScenarioZone[] {
  return scenario.recommendations.slice(0, 4).map((recommendation, index) => ({
    rank: recommendation.rank,
    tone: getRankTone(recommendation.rank),
    ...previewPositions[index],
  }));
}

function MiniScenarioMap({ scenario }: { scenario: CommuteScenario }) {
  const zones = getPreviewZones(scenario);
  const topZone = zones[0] ?? { x: 64, y: 34 };

  return (
    <svg
      className="scenario-mini-map"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Mini map preview for ${scenario.workplace.address}`}
    >
      <defs>
        <pattern id={`${scenario.scenarioId}-grid`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(33,28,24,0.09)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${scenario.scenarioId}-grid)`} />
      <path className="scenario-mini-road scenario-mini-road--one" d="M4 72 C20 63 31 57 45 50 S73 36 96 24" />
      <path className="scenario-mini-road scenario-mini-road--two" d="M18 8 C30 29 45 41 59 50 S81 72 94 92" />
      <circle className="scenario-mini-radius" cx="50" cy="52" r="34" />
      {zones.map((zone) => (
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

function ScenarioCard({ scenario }: { scenario: CommuteScenario }) {
  const topRecommendation = scenario.recommendations[0];
  const topNeighborhood = topRecommendation?.zone.name ?? "No ranked zones";
  const driveMinutes = topRecommendation?.commuteAnalysis.driveTimePeakMinutes;
  const transitMinutes = topRecommendation?.commuteAnalysis.transitTimePeakMinutes;
  const insightState = scenario.recommendations.some(
    (recommendation) => recommendation.explanationSummary,
  )
    ? "AI insights added"
    : "Needs insights";

  return (
    <article className="scenario-card">
      <MiniScenarioMap scenario={scenario} />
      <div className="scenario-card__body">
        <div className="scenario-card__header">
          <div>
            <p>{formatDate(scenario.createdAt)}</p>
            <h2>{scenario.workplace.address}</h2>
          </div>
        </div>

        <div className="scenario-card__summary">
          <span>{scenario.searchRadiusMiles} mi radius</span>
          <span>{scenario.recommendations.length} areas</span>
          <span>{insightState}</span>
        </div>

        <div className="scenario-card__rank">
          <span>1</span>
          <div>
            <small>Top match</small>
            <strong>{topNeighborhood}</strong>
          </div>
        </div>

        <dl className="scenario-card__metrics">
          <div>
            <dt>Drive</dt>
            <dd>{driveMinutes ? `${driveMinutes} min` : "--"}</dd>
          </div>
          <div>
            <dt>Transit</dt>
            <dd>{transitMinutes ? `${transitMinutes} min` : "--"}</dd>
          </div>
        </dl>

        <Link className="scenario-card__open" to={`/dashboard?scenarioId=${scenario.scenarioId}`}>
          Open scenario
        </Link>
      </div>
    </article>
  );
}

function SavedScenariosPage() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "radius" | "drive">("recent");
  const [scenarios, setScenarios] = useState<CommuteScenario[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadScenarios() {
      setStatus("loading");
      try {
        const savedScenarios = await fetchSavedScenarios();
        if (cancelled) return;
        setScenarios(savedScenarios);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    }

    loadScenarios();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleScenarios = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredScenarios = normalizedQuery
      ? scenarios.filter((scenario) =>
          [
            scenario.workplace.address,
            scenario.recommendations[0]?.zone.name ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : scenarios;

    return [...filteredScenarios].sort((a, b) => {
      if (sortBy === "radius") {
        return b.searchRadiusMiles - a.searchRadiusMiles;
      }
      if (sortBy === "drive") {
        const aDrive =
          a.recommendations[0]?.commuteAnalysis.driveTimePeakMinutes ??
          Number.POSITIVE_INFINITY;
        const bDrive =
          b.recommendations[0]?.commuteAnalysis.driveTimePeakMinutes ??
          Number.POSITIVE_INFINITY;
        return aDrive - bDrive;
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [query, scenarios, sortBy]);

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
        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as "recent" | "radius" | "drive")
          }
          aria-label="Sort scenarios"
        >
          <option value="recent">Most recent</option>
          <option value="radius">Radius</option>
          <option value="drive">Shortest drive</option>
        </select>
      </section>

      {status === "loading" ? (
        <section className="saved-scenarios-empty">
          <h2>Loading saved scenarios</h2>
          <p>Fetching your commute searches.</p>
        </section>
      ) : status === "error" ? (
        <section className="saved-scenarios-empty">
          <h2>Unable to load saved scenarios</h2>
          <p>Please try refreshing the page.</p>
        </section>
      ) : visibleScenarios.length > 0 ? (
        <section className="scenario-grid" aria-label="Saved scenarios">
          {visibleScenarios.map((scenario) => (
            <ScenarioCard key={scenario.scenarioId} scenario={scenario} />
          ))}
        </section>
      ) : (
        <section className="saved-scenarios-empty">
          <h2>No saved scenarios found</h2>
          <p>Try a different search or save a new commute scenario.</p>
          <Link to="/dashboard">Start a search</Link>
        </section>
      )}
    </main>
  );
}

export default withRequirements(SavedScenariosPage, [userSignedInRequirement]);
