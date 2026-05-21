/**
 * Enum representing the lifecycle state machine of a CommuteScenario.
 * - DRAFT: Initial state. The scenario has been created but may lack valid input (e.g., missing address).
 * - SUBMITTED: Valid input has been provided and the scenario is queued for processing.
 * - ANALYZING: The backend is currently identifying candidate zones and fetching external routing/transit data.
 * - READY: Analysis is complete. The scenario has successfully ranked zones and is ready to display.
 * - FAILED: Processing was interrupted, typically due to an invalid address or third-party API failure.
 * - SAVED: The completed scenario has been explicitly preserved by the user for future retrieval.
 */
export enum ScenarioStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  ANALYZING = "ANALYZING",
  READY = "READY",
  FAILED = "FAILED",
  SAVED = "SAVED",
}

/**
 * Represents a registered user of the system.
 * - userId: Unique identifier for the user account.
 * - name: Full display name of the user.
 * - email: The user's registered email address.
 */
export interface User {
  userId: string;
  name: string;
  email: string;
}

/**
 * Represents the user's target office location.
 * - address: Full, geocodable string representation of the office address.
 * - latitude: Geocoded latitude coordinate.
 * - longitude: Geocoded longitude coordinate.
 */
export interface Workplace {
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * Stores the user's commute and lifestyle preferences.
 * - maxCommuteMinutes: The absolute maximum acceptable commute time in minutes.
 * - avoidHighways: Toggle to exclude highways from driving commute calculations.
 * - maxTransfers: Maximum number of acceptable vehicle transfers on a transit route.
 * - prefersTransit: Toggle indicating a strong preference for public transportation.
 * - prefersDriving: Toggle indicating a strong preference for driving.
 * - wantsQuietArea: Toggle to prioritize neighborhoods with higher quietness scores.
 */
export interface PreferenceProfile {
  maxCommuteMinutes: number;
  avoidHighways: boolean;
  maxTransfers: number;
  prefersTransit: boolean;
  prefersDriving: boolean;
  wantsQuietArea: boolean;
}

/**
 * Stores the quantitative commute metrics computed for a zone.
 * - driveTimePeakMinutes: Estimated driving time during rush hour/peak traffic.
 * - transitTimePeakMinutes: Estimated public transit time during peak hours.
 * - walkingMinutesToStop: Minutes required to walk to the nearest relevant transit stop.
 * - transferCount: Number of transfers required for the optimal transit route.
 * - congestionLevel: A metric representing typical traffic density or delay severity.
 */
export interface CommuteAnalysis {
  driveTimePeakMinutes: number;
  transitTimePeakMinutes: number;
  walkingMinutesToStop: number;
  transferCount: number;
  congestionLevel: number;
}

/**
 * Stores qualitative neighborhood scores.
 * - walkabilityScore: Metric evaluating how friendly the area is to pedestrian traffic.
 * - groceryScore: Metric evaluating proximity and access to fresh food and grocery stores.
 * - parkScore: Metric evaluating proximity to public parks and green spaces.
 * - nightlifeScore: Metric evaluating access to entertainment, restaurants, and bars.
 * - quietnessScore: Metric evaluating the general ambient noise level of the neighborhood.
 */
export interface LifestyleAnalysis {
  walkabilityScore: number;
  groceryScore: number;
  parkScore: number;
  nightlifeScore: number;
  quietnessScore: number;
}

/**
 * Represents a single zone's evaluation within a scenario.
 * - rank: The zone's ordered position compared to other candidates (1 being the best).
 * - totalScore: The aggregated score calculated from commute and lifestyle analyses.
 * - explanationSummary: The AI-generated natural language summary explaining why this zone was recommended.
 * - commuteAnalysis: The underlying quantitative commute data for this recommendation.
 * - lifestyleAnalysis: The underlying qualitative lifestyle data for this recommendation.
 */
export interface Recommendation {
  rank: number;
  totalScore: number;
  explanationSummary: string;
  commuteAnalysis: CommuteAnalysis;
  lifestyleAnalysis: LifestyleAnalysis;
}

/**
 * Represents a candidate neighborhood within the search radius.
 * - zoneId: Unique identifier for the neighborhood zone.
 * - name: The common display name of the neighborhood (e.g., "Westwood", "Culver City").
 * - boundaryGeoJson: The GeoJSON boundary string used to render the zone shape on the map.
 * - centerLat: Latitude coordinate of the zone's geographical center.
 * - centerLng: Longitude coordinate of the zone's geographical center.
 */
export interface Zone {
  zoneId: string;
  name: string;
  boundaryGeoJson: string;
  centerLat: number;
  centerLng: number;
}

/**
 * The central entity representing a single neighborhood search.
 * - scenarioId: Unique identifier for this specific search iteration.
 * - searchRadiusMiles: The maximum radius around the workplace to search for neighborhoods.
 * - createdAt: Timestamp of when the search was initiated.
 * - status: The current position of this scenario in the processing lifecycle.
 * - workplace: The anchor destination for all commute calculations.
 * - preferenceProfile: The active set of filters and preferences guiding the recommendations.
 * - recommendations: The list of evaluated zones, sorted by rank.
 */
export interface CommuteScenario {
  scenarioId: string;
  searchRadiusMiles: number;
  createdAt: Date;
  status: ScenarioStatus;
  workplace: Workplace;
  preferenceProfile: PreferenceProfile;
  recommendations: Recommendation[];
}

/**
 * Represents a specific housing unit within a zone.
 * - listingId: The unique identifier provided by the external housing API (e.g., Zillow).
 * - address: The specific street address of the apartment or house.
 * - rent: The monthly cost in USD.
 * - bedrooms: Total number of bedrooms.
 * - bathrooms: Total number of bathrooms.
 * - url: The direct link to view the full listing on the provider's website.
 */
export interface HousingListing {
  listingId: string;
  address: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  url: string;
}
