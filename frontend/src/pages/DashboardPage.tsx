import React, { useEffect, useState } from "react";
import Topbar from "../components/Dashboard/Topbar";
import FilterPanel from "../components/Dashboard/FilterPanel";
import ResultsPanel from "../components/Dashboard/ResultsPanel";
import DashboardMap from "../components/Dashboard/DashboardMap";
import DetailPanel from "../components/Dashboard/DetailPanel";
import { explainScenario } from "../services/scenario";
import "../components/Dashboard/Dashboard.css";

import { withRequirements, userSignedInRequirement } from "../lib/Requirements";

import {
  createScenario,
  fetchScenario,
  fetchZoneListings,
  updateScenarioPreferences,
} from "../services/scenario";
import type {
  CommuteScenario,
  HousingListing,
  PreferenceProfile,
} from "../models/types";

type ListingsStatus = "idle" | "loading" | "error";

// Remember the active scenario so filters (stored on the scenario's
// PreferenceProfile) survive navigating away and back.
const ACTIVE_SCENARIO_KEY = "relocateiq.activeScenarioId";

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
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

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
      localStorage.setItem(ACTIVE_SCENARIO_KEY, newScenario.scenarioId);

      if (newScenario.recommendations.length > 0) {
        setSelectedZoneId(newScenario.recommendations[0].zone.zoneId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario.");
    } finally {
      setIsLoading(false);
    }
  }

  // Apply a manual filter change: persist it to the scenario's PreferenceProfile
  // and re-rank server-side, then swap in the updated scenario.
  async function handleFilterChange(patch: Partial<PreferenceProfile>) {
    if (!scenario) return;

    setIsApplyingFilters(true);
    setError("");
    try {
      const updated = await updateScenarioPreferences(scenario.scenarioId, patch);
      setScenario(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply filters.",
      );
    } finally {
      setIsApplyingFilters(false);
    }
  }

  // On first load, restore the last scenario (and its saved filters) if one
  // exists, so leaving and returning shows the same filtered map.
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_SCENARIO_KEY);
    if (!savedId) return;

    let cancelled = false;
    (async () => {
      try {
        const restored = await fetchScenario(savedId);
        if (cancelled) return;
        setScenario(restored);
        setRadiusMiles(restored.searchRadiusMiles);
        if (restored.recommendations.length > 0) {
          setSelectedZoneId(restored.recommendations[0].zone.zoneId);
        }
      } catch {
        // Scenario is gone (e.g. 404); drop the stale pointer.
        localStorage.removeItem(ACTIVE_SCENARIO_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="dashboard-left-rail">
              <FilterPanel
                prefersTransit={scenario.preferenceProfile.prefersTransit}
                avoidHighways={scenario.preferenceProfile.avoidHighways}
                maxCommuteMinutes={scenario.preferenceProfile.maxCommuteMinutes}
                matchingCount={
                  scenario.recommendations.filter((rec) => rec.meetsFilters)
                    .length
                }
                totalCount={scenario.recommendations.length}
                isApplying={isApplyingFilters}
                onChange={handleFilterChange}
              />
              <ResultsPanel
                recommendations={scenario.recommendations}
                selectedId={selectedZoneId}
                onSelect={setSelectedZoneId}
              />
            </div>
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
