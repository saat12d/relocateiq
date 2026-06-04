import { getWithAuth, patchWithAuth, postWithAuth } from "../lib/auth";
import type {
  CommuteScenario,
  HousingListing,
  PreferenceProfile,
  RefineScenarioResponse,
} from "../models/types";

// Matching the CreateScenarioRequest Pydantic schema
export type CreateScenarioPayload = {
  workplaceAddress: string;
  maxRadiusMiles: number;
  // Departure time of day as minutes since midnight (e.g. 450 = 7:30 AM).
  departureTimeMinutes?: number;
  preferences: Partial<PreferenceProfile>;
};

/** Thrown when the AI cannot interpret a refinement message (HTTP 422). */
export class ScenarioClarificationError extends Error {
  readonly clarifyingPrompt: string;

  constructor(clarifyingPrompt: string) {
    super(clarifyingPrompt);
    this.name = "ScenarioClarificationError";
    this.clarifyingPrompt = clarifyingPrompt;
  }
}

async function throwScenarioError(
  response: Response,
  fallback: string,
): Promise<never> {
  let body: { detail?: unknown } | null = null;
  try {
    body = await response.json();
  } catch {
    // Response had no JSON body.
  }

  const detail = body?.detail;
  if (
    response.status === 422 &&
    detail &&
    typeof detail === "object" &&
    "clarifyingPrompt" in detail &&
    typeof (detail as { clarifyingPrompt: unknown }).clarifyingPrompt === "string"
  ) {
    throw new ScenarioClarificationError(
      (detail as { clarifyingPrompt: string }).clarifyingPrompt,
    );
  }

  if (typeof detail === "string") {
    throw new Error(detail);
  }

  if (response.status === 502) {
    throw new Error("AI service unavailable. Please try again.");
  }

  throw new Error(fallback);
}

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
 * Fetches scenarios the current user has saved for later reuse.
 * Maps to: GET /api/v1/scenarios
 */
export async function fetchSavedScenarios(): Promise<CommuteScenario[]> {
  const response = await getWithAuth("/api/v1/scenarios");

  if (!response.ok) {
    throw new Error("Failed to load saved scenarios.");
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

/**
 * Marks a scenario as saved for the current user.
 * Maps to: POST /api/v1/scenarios/{scenario_id}/save
 */
export async function saveScenario(
  scenarioId: string,
): Promise<CommuteScenario> {
  const response = await postWithAuth(`/api/v1/scenarios/${scenarioId}/save`, {});

  if (!response.ok) {
    throw new Error("Unable to save this scenario.");
  }

  return response.json();
}

/**
 * Triggers the AI explanation for a ranked scenario.
 * Maps to: POST /api/v1/scenarios/{scenario_id}/explain
 */
export async function explainScenario(
  scenarioId: string,
): Promise<CommuteScenario> {
  const response = await postWithAuth(
    `/api/v1/scenarios/${scenarioId}/explain`,
    {},
  );

  if (!response.ok) {
    await throwScenarioError(response, "Failed to generate AI explanations.");
  }

  return response.json();
}

/**
 * Parses natural-language preferences, re-ranks zones, and returns an explanation.
 * Maps to: POST /api/v1/scenarios/{scenario_id}/refine
 */
export async function refineScenario(
  scenarioId: string,
  userMessage: string,
): Promise<RefineScenarioResponse> {
  const response = await postWithAuth(
    `/api/v1/scenarios/${scenarioId}/refine`,
    { userMessage },
  );

  if (!response.ok) {
    await throwScenarioError(response, "Failed to refine recommendations.");
  }

  return response.json();
}

/**
 * Fetches housing listings for a ranked zone.
 * Maps to: GET /api/v1/zones/{zone_id}/listings
 */
export async function fetchZoneListings(
  zoneId: string,
): Promise<HousingListing[]> {
  const response = await getWithAuth(`/api/v1/zones/${zoneId}/listings`);

  if (!response.ok) {
    throw new Error("Failed to load listings for this neighborhood.");
  }

  return response.json();
}
