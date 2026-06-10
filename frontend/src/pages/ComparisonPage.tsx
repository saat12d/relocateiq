import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchScenario } from "../services/scenario";
import type { CommuteScenario, Recommendation } from "../models/types";
import "../components/Comparison/Comparison.css";
import { userSignedInRequirement, withRequirements } from "../lib/Requirements";

function ComparisonPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [scenario, setScenario] = useState<CommuteScenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Store the currently selected Zone IDs for comparison
  const [zoneAId, setZoneAId] = useState<string>("");
  const [zoneBId, setZoneBId] = useState<string>("");

  const scenarioId = searchParams.get("scenarioId");

  useEffect(() => {
    if (!scenarioId) {
      setError("No scenario provided for comparison.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    async function loadData() {
      try {
        const loadedScenario = await fetchScenario(scenarioId!);
        if (cancelled) return;

        setScenario(loadedScenario);

        const validRecs = loadedScenario.recommendations.filter(
          (r) => r.meetsFilters,
        );

        // Default to the top 2 ranked neighborhoods if available
        if (validRecs.length >= 2) {
          setZoneAId(validRecs[0].zone.zoneId);
          setZoneBId(validRecs[1].zone.zoneId);
        } else if (validRecs.length === 1) {
          setZoneAId(validRecs[0].zone.zoneId);
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load comparison data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  if (isLoading)
    return <div className="comparison-loading">Loading comparison...</div>;
  if (error) return <div className="comparison-error">{error}</div>;
  if (!scenario) return null;

  // Grab the full Recommendation objects based on the selected IDs
  const zoneA = scenario.recommendations.find((r) => r.zone.zoneId === zoneAId);
  const zoneB = scenario.recommendations.find((r) => r.zone.zoneId === zoneBId);

  const validRecommendations = scenario.recommendations.filter(
    (r) => r.meetsFilters,
  );

  // Reusable dropdown component for the table headers
  const ZoneSelector = ({
    selectedId,
    onChange,
  }: {
    selectedId: string;
    onChange: (id: string) => void;
  }) => (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      className="comparison-selector"
    >
      <option value="" disabled>
        Select a neighborhood...
      </option>
      {validRecommendations.map((rec) => (
        <option key={rec.zone.zoneId} value={rec.zone.zoneId}>
          {rec.rank > 0 ? `${rec.rank}. ` : ""}
          {rec.zone.name}
        </option>
      ))}{" "}
    </select>
  );

  return (
    <main className="comparison-page">
      <header className="comparison-header">
        <button onClick={() => navigate(-1)} className="back-link">
          &larr; Back to Map
        </button>
        <h1>Neighborhood Comparison</h1>
      </header>

      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="metric-col">Metric</th>
              <th>
                <ZoneSelector selectedId={zoneAId} onChange={setZoneAId} />
                {zoneA && (
                  <span className="score-badge">
                    {zoneA.totalScore.toFixed(0)} Score
                  </span>
                )}
              </th>
              <th>
                <ZoneSelector selectedId={zoneBId} onChange={setZoneBId} />
                {zoneB && (
                  <span className="score-badge">
                    {zoneB.totalScore.toFixed(0)} Score
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Peak Drive Time</td>
              <td>{zoneA?.commuteAnalysis.driveTimePeakMinutes ?? "—"} mins</td>
              <td>{zoneB?.commuteAnalysis.driveTimePeakMinutes ?? "—"} mins</td>
            </tr>
            <tr>
              <td>Peak Transit Time</td>
              <td>
                {zoneA?.commuteAnalysis.transitTimePeakMinutes ?? "—"} mins
              </td>
              <td>
                {zoneB?.commuteAnalysis.transitTimePeakMinutes ?? "—"} mins
              </td>
            </tr>
            <tr>
              <td>Walk to Nearest Stop</td>
              <td>{zoneA?.commuteAnalysis.walkingMinutesToStop ?? "—"} mins</td>
              <td>{zoneB?.commuteAnalysis.walkingMinutesToStop ?? "—"} mins</td>
            </tr>
            <tr>
              <td>Transit Transfers</td>
              <td>{zoneA?.commuteAnalysis.transferCount ?? "—"}</td>
              <td>{zoneB?.commuteAnalysis.transferCount ?? "—"}</td>
            </tr>
            <tr>
              <td>AI Lifestyle Note</td>
              <td className="ai-note">
                {zoneA?.explanationSummary
                  ? `"${zoneA.explanationSummary}"`
                  : "—"}
              </td>
              <td className="ai-note">
                {zoneB?.explanationSummary
                  ? `"${zoneB.explanationSummary}"`
                  : "—"}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td></td>
              <td>
                <button
                  className="explore-listings-btn"
                  disabled={!zoneA}
                  onClick={() => navigate(`/zones/${zoneA!.zone.zoneId}/listings`, { state: { scenarioId } })}
                >
                  Explore Listings
                </button>
              </td>
              <td>
                <button
                  className="explore-listings-btn"
                  disabled={!zoneB}
                  onClick={() => navigate(`/zones/${zoneB!.zone.zoneId}/listings`, { state: { scenarioId } })}
                >
                  Explore Listings
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}

export default withRequirements(ComparisonPage, [userSignedInRequirement]);
