import React, { useEffect, useState } from "react";
import Topbar from "../components/Dashboard/Topbar";
import ResultsPanel from "../components/Dashboard/ResultsPanel";
import DashboardMap from "../components/Dashboard/DashboardMap";
import DetailPanel from "../components/Dashboard/DetailPanel";
import { explainScenario } from "../services/scenario";
import "../components/Dashboard/Dashboard.css";

import { withRequirements, userSignedInRequirement } from "../lib/Requirements";

import { createScenario, fetchZoneListings } from "../services/scenario";
import type { CommuteScenario, HousingListing } from "../models/types";

type ListingsStatus = "idle" | "loading" | "error";

function DashboardPage() {
  // Set up state for the API data and loading status
  const [scenario, setScenario] = useState<CommuteScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(15);
  // Departure time of day as minutes since midnight (default 7:30 AM).
  const [departureMinutes, setDepartureMinutes] = useState(450);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [listingsByZone, setListingsByZone] = useState<
    Record<string, HousingListing[]>
  >({});
  const [listingsStatus, setListingsStatus] = useState<ListingsStatus>("idle");

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Core search call to the backend, shared by the topbar search and the
  // departure-time slider so both run the exact same scenario request.
  async function runSearch(
    workAddress: string,
    searchRadius: number,
    departure: number,
  ) {
    setIsLoading(true);
    setError("");

    try {
      const newScenario = await createScenario({
        workplaceAddress: workAddress,
        maxRadiusMiles: searchRadius,
        departureTimeMinutes: departure,
        preferences: {},
      });

      setScenario(newScenario);
      setListingsByZone({});

      if (newScenario.recommendations.length > 0) {
        setSelectedZoneId(newScenario.recommendations[0].zone.zoneId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario.");
    } finally {
      setIsLoading(false);
    }
  }

  // Topbar search: uses the currently selected departure time.
  function handleCreateSearch(workAddress: string, searchRadius: number) {
    return runSearch(workAddress, searchRadius, departureMinutes);
  }

  // Departure slider: re-run the search for the existing workplace/radius so
  // rankings reflect traffic at the newly chosen time.
  function handleDepartureCommit(nextDeparture: number) {
    setDepartureMinutes(nextDeparture);
    if (scenario) {
      runSearch(scenario.workplace.address, radiusMiles, nextDeparture);
    }
  }

  async function handleGenerateInsight() {
    console.log(1);
    if (!scenario) return;

    console.log(1);

    setIsGeneratingAI(true);
    try {
      const updatedScenario = await explainScenario(scenario.scenarioId);
      console.log(2);

      setScenario(updatedScenario);
    } catch (err) {
      console.error("AI Generation failed:", err);
      console.log(3);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  // Find the currently selected recommendation based on the ID
  const selectedRecommendation = scenario?.recommendations.find(
    (rec) => rec.zone.zoneId === selectedZoneId,
  );

  useEffect(() => {
    if (!selectedZoneId || listingsByZone[selectedZoneId]) {
      setListingsStatus("idle");
      return;
    }

    let cancelled = false;

    async function loadListings() {
      setListingsStatus("loading");
      try {
        const listings = await fetchZoneListings(selectedZoneId);
        if (cancelled) return;
        setListingsByZone((current) => ({
          ...current,
          [selectedZoneId]: listings,
        }));
        setListingsStatus("idle");
      } catch (err) {
        if (!cancelled) setListingsStatus("error");
      }
    }

    loadListings();
    return () => {
      cancelled = true;
    };
  }, [selectedZoneId, listingsByZone]);

  return (
    <main className="dashboard-page">
      {/* Pass the search function down to the Topbar */}
      <Topbar
        onSearch={handleCreateSearch}
        isLoading={isLoading}
        radiusMiles={radiusMiles}
        onRadiusChange={setRadiusMiles}
      />

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
              departureMinutes={departureMinutes}
              onDepartureCommit={handleDepartureCommit}
              isLoading={isLoading}
            />
            <DetailPanel
              selected={selectedRecommendation}
              isGenerating={isGeneratingAI}
              onGenerateInsight={handleGenerateInsight}
              listings={
                selectedZoneId ? (listingsByZone[selectedZoneId] ?? []) : []
              }
              listingsStatus={listingsStatus}
            />
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
