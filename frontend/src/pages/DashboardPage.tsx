import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Dashboard/Topbar";
import FilterPanel from "../components/Dashboard/FilterPanel";
import AiRefinementPanel from "../components/Dashboard/AiRefinementPanel";
import ResultsPanel from "../components/Dashboard/ResultsPanel";
import DashboardMap from "../components/Dashboard/DashboardMap";
import DetailPanel from "../components/Dashboard/DetailPanel";
import "../components/Dashboard/Dashboard.css";

import { withRequirements, userSignedInRequirement } from "../lib/Requirements";

import {
  createScenario,
  explainScenario,
  fetchScenario,
  fetchZoneListings,
  refineScenario,
  ScenarioClarificationError,
  saveScenario,
  updateScenarioPreferences,
} from "../services/scenario";
import type {
  CommuteScenario,
  HousingListing,
  PreferenceProfile,
} from "../models/types";
import { ScenarioStatus } from "../models/types";

type ListingsStatus = "idle" | "loading" | "error";

const ACTIVE_SCENARIO_KEY = "relocateiq.activeScenarioId";

function pickSelectedZoneId(
  recommendations: CommuteScenario["recommendations"],
  currentId: string | null,
): string | null {
  if (
    currentId &&
    recommendations.some((rec) => rec.zone.zoneId === currentId)
  ) {
    return currentId;
  }
  const topRanked =
    recommendations.find((rec) => rec.rank === 1) ?? recommendations[0];
  return topRanked?.zone.zoneId ?? null;
}

function DashboardPage() {
  const [searchParams] = useSearchParams();
  const [scenario, setScenario] = useState<CommuteScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [departureMinutes, setDepartureMinutes] = useState(450);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [listingsByZone, setListingsByZone] = useState<
    Record<string, HousingListing[]>
  >({});
  const [listingsStatus, setListingsStatus] = useState<ListingsStatus>("idle");

  const [isExplaining, setIsExplaining] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [refinementSummary, setRefinementSummary] = useState<string | null>(
    null,
  );
  const [clarifyingPrompt, setClarifyingPrompt] = useState<string | null>(null);

  const navigate = useNavigate();

  function goToComparison() {
    if (scenario) {
      navigate(`/compare?scenarioId=${scenario.scenarioId}`);
    }
  }

  const runExplain = useCallback(async (scenarioId: string) => {
    setIsExplaining(true);
    setError("");
    try {
      const explained = await explainScenario(scenarioId);
      setScenario(explained);
      setSelectedZoneId((current) =>
        pickSelectedZoneId(explained.recommendations, current),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate AI explanations.",
      );
    } finally {
      setIsExplaining(false);
    }
  }, []);

  async function runSearch(
    workAddress: string,
    searchRadius: number,
    departure: number,
  ) {
    setIsLoading(true);
    setError("");
    setRefinementSummary(null);
    setClarifyingPrompt(null);

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

      if (newScenario.status === ScenarioStatus.RANKED) {
        await runExplain(newScenario.scenarioId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFilterChange(patch: Partial<PreferenceProfile>) {
    if (!scenario) return;

    setIsApplyingFilters(true);
    setError("");
    try {
      const updated = await updateScenarioPreferences(
        scenario.scenarioId,
        patch,
      );
      setScenario(updated);
      setSelectedZoneId((current) =>
        pickSelectedZoneId(updated.recommendations, current),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply filters.");
    } finally {
      setIsApplyingFilters(false);
    }
  }

  async function handleRefine(userMessage: string) {
    if (!scenario) return;

    setIsRefining(true);
    setError("");
    setClarifyingPrompt(null);

    try {
      const result = await refineScenario(scenario.scenarioId, userMessage);
      setScenario(result.scenario);
      setRefinementSummary(result.explanationSummary);
      setSelectedZoneId((current) =>
        pickSelectedZoneId(result.scenario.recommendations, current),
      );
    } catch (err) {
      if (err instanceof ScenarioClarificationError) {
        setClarifyingPrompt(err.clarifyingPrompt);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refine recommendations.",
      );
    } finally {
      setIsRefining(false);
    }
  }

  async function handleSaveScenario() {
    if (!scenario || scenario.status === ScenarioStatus.SAVED) return;

    setIsSavingScenario(true);
    setError("");
    try {
      const savedScenario = await saveScenario(scenario.scenarioId);
      setScenario(savedScenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scenario.");
    } finally {
      setIsSavingScenario(false);
    }
  }

  // Restore the last active scenario from localStorage when not opening via URL.
  useEffect(() => {
    if (searchParams.get("scenarioId")) return;

    const savedId = localStorage.getItem(ACTIVE_SCENARIO_KEY);
    if (!savedId) return;

    let cancelled = false;
    (async () => {
      try {
        const restored = await fetchScenario(savedId);
        if (cancelled) return;

        setScenario(restored);
        setRadiusMiles(restored.searchRadiusMiles);
        setSelectedZoneId(pickSelectedZoneId(restored.recommendations, null));

        if (restored.status === ScenarioStatus.RANKED) {
          await runExplain(restored.scenarioId);
        }
      } catch {
        localStorage.removeItem(ACTIVE_SCENARIO_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runExplain, searchParams]);

  function handleCreateSearch(workAddress: string, searchRadius: number) {
    return runSearch(workAddress, searchRadius, departureMinutes);
  }

  function handleDepartureCommit(nextDeparture: number) {
    setDepartureMinutes(nextDeparture);
    if (scenario) {
      runSearch(scenario.workplace.address, radiusMiles, nextDeparture);
    }
  }

  const selectedRecommendation = scenario?.recommendations.find(
    (rec) => rec.zone.zoneId === selectedZoneId,
  );

  const canRefine =
    scenario?.status === ScenarioStatus.EXPLAINED ||
    scenario?.status === ScenarioStatus.SAVED;

  // Open a saved scenario from /dashboard?scenarioId=...
  useEffect(() => {
    const scenarioIdFromUrl = searchParams.get("scenarioId");
    if (!scenarioIdFromUrl) return;

    let cancelled = false;

    async function loadScenario(id: string) {
      setIsLoading(true);
      setError("");
      setRefinementSummary(null);
      setClarifyingPrompt(null);

      try {
        const loadedScenario = await fetchScenario(id);
        if (cancelled) return;

        setScenario(loadedScenario);
        setListingsByZone({});
        setRadiusMiles(loadedScenario.searchRadiusMiles);
        localStorage.setItem(ACTIVE_SCENARIO_KEY, loadedScenario.scenarioId);
        setSelectedZoneId(
          pickSelectedZoneId(loadedScenario.recommendations, null),
        );

        if (loadedScenario.status === ScenarioStatus.RANKED) {
          await runExplain(loadedScenario.scenarioId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load scenario.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadScenario(scenarioIdFromUrl);
    return () => {
      cancelled = true;
    };
  }, [runExplain, searchParams]);

  useEffect(() => {
    const zoneId = selectedZoneId;
    if (!zoneId || listingsByZone[zoneId]) {
      setListingsStatus("idle");
      return;
    }

    let cancelled = false;

    async function loadListings(id: string) {
      setListingsStatus("loading");
      try {
        const listings = await fetchZoneListings(id);
        if (cancelled) return;
        setListingsByZone((current) => ({
          ...current,
          [id]: listings,
        }));
        setListingsStatus("idle");
      } catch {
        if (!cancelled) setListingsStatus("error");
      }
    }

    loadListings(zoneId);
    return () => {
      cancelled = true;
    };
  }, [selectedZoneId, listingsByZone]);

  return (
    <main className="dashboard-page">
      <Topbar
        onSearch={handleCreateSearch}
        isLoading={isLoading}
        radiusMiles={radiusMiles}
        onRadiusChange={setRadiusMiles}
      />

      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-workspace">
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

              <AiRefinementPanel
                disabled={!canRefine}
                isExplaining={isExplaining}
                isRefining={isRefining}
                lastSummary={refinementSummary}
                clarifyingPrompt={clarifyingPrompt}
                onRefine={handleRefine}
              />

              <button
                className="compare-route-button"
                onClick={goToComparison}
                disabled={!scenario || scenario.recommendations.length < 2}
              >
                Compare Neighborhoods &rarr;
              </button>
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
              isExplaining={isExplaining}
              isSaved={scenario.status === ScenarioStatus.SAVED}
              isSaving={isSavingScenario}
              onSaveScenario={handleSaveScenario}
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

export default withRequirements(DashboardPage, [userSignedInRequirement]);
