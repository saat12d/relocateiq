import { getWithAuth, patchWithAuth, postWithAuth } from "../lib/auth";
import type { CommuteScenario, PreferenceProfile } from "../models/types";

// Matching the CreateScenarioRequest Pydantic schema
export type CreateScenarioPayload = {
  workplaceAddress: string;
  maxRadiusMiles: number;
  preferences: Partial<PreferenceProfile>;
};

/**
 * Generates a new commute scenario and ranks neighborhoods.
 * Maps to: POST /api/v1/scenarios
 */
export async function createScenario(
  payload: CreateScenarioPayload,
): Promise<CommuteScenario> {
  const response = await postWithAuth("/api/v1/scenarios", payload);

  if (!response.ok) {
    throw new Error("Failed to generate recommendations. Please try again.");
  }

  return response.json();
}

/**
 * Fetches an existing scenario by its unique ID.
 * Maps to: GET /api/v1/scenarios/{scenario_id}
 */
export async function fetchScenario(
  scenarioId: string,
): Promise<CommuteScenario> {
  const response = await getWithAuth(`/api/v1/scenarios/${scenarioId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Scenario not found.");
    }
    throw new Error("Failed to retrieve your saved scenario.");
  }

  return response.json();
}

/**
 * Updates the user's preferences for a specific scenario and recalculates rankings.
 * Maps to: PATCH /api/v1/scenarios/{scenario_id}/preferences
 */
export async function updateScenarioPreferences(
  scenarioId: string,
  preferences: Partial<PreferenceProfile>,
): Promise<CommuteScenario> {
  const response = await patchWithAuth(
    `/api/v1/scenarios/${scenarioId}/preferences`,
    preferences,
  );

  if (!response.ok) {
    throw new Error("Unable to update preferences at this time.");
  }

  return response.json();
}
