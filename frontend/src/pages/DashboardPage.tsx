import React, { useState } from "react";
import Topbar from "../components/Dashboard/Topbar";
import ResultsPanel from "../components/Dashboard/ResultsPanel";
import DashboardMap from "../components/Dashboard/DashboardMap";
import DetailPanel from "../components/Dashboard/DetailPanel";
import { neighborhoods } from "../components/Dashboard/data";
import "../components/Dashboard/Dashboard.css";

import { withRequirements, userSignedInRequirement } from "../lib/Requirements";

import { createScenario } from "../services/scenario";
import type { CommuteScenario } from "../models/types";

function DashboardPage() {
  // Set up state for the API data and loading status
  const [scenario, setScenario] = useState<CommuteScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Create the function that calls your backend
  async function handleCreateSearch(workAddress: string) {
    setIsLoading(true);
    setError("");

    try {
      const newScenario = await createScenario({
        workplaceAddress: workAddress,
        maxRadiusMiles: 15,
        preferences: {},
      });

      setScenario(newScenario);

      if (newScenario.recommendations.length > 0) {
        setSelectedZoneId(newScenario.recommendations[0].zone.zoneId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario.");
    } finally {
      setIsLoading(false);
    }
  }

  // Find the currently selected recommendation based on the ID
  const selectedRecommendation = scenario?.recommendations.find(
    (rec) => rec.zone.zoneId === selectedZoneId,
  );

  return (
    <main className="dashboard-page">
      {/* Pass the search function down to the Topbar */}
      <Topbar onSearch={handleCreateSearch} isLoading={isLoading} />

      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-workspace">
        {/* Only render the panels if we have data back from the API */}
        {scenario && selectedRecommendation ? (
          <>
            <ResultsPanel
              recommendations={scenario.recommendations}
              selectedId={selectedZoneId}
              onSelect={setSelectedZoneId}
            />
            <DashboardMap
              recommendations={scenario.recommendations}
              selectedId={selectedZoneId}
              onSelect={setSelectedZoneId}
              workplace={scenario.workplace}
            />
            <DetailPanel selected={selectedRecommendation} />
          </>
        ) : (
          <div className="dashboard-empty-state">
            {isLoading
              ? "Analyzing commute zones..."
              : "Enter your workplace to start."}
          </div>
        )}
      </div>
    </main>
  );
}
// export default DashboardPage;

export default withRequirements(DashboardPage, [userSignedInRequirement]);
