from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ScenarioStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    ANALYZING = "ANALYZING"
    RANKED = "RANKED"
    EXPLAINED = "EXPLAINED"
    FAILED = "FAILED"
    SAVED = "SAVED"


class CreateScenarioRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workplace_address: str = Field(..., min_length=1, alias="workplaceAddress")
    max_radius_miles: float = Field(..., ge=0.5, le=50, alias="maxRadiusMiles")


class UpdatePreferencesRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prefers_transit: bool | None = Field(None, alias="prefersTransit")
    avoid_highways: bool | None = Field(None, alias="avoidHighways")
    max_commute_minutes: int | None = Field(None, ge=5, le=60, alias="maxCommuteMinutes")


class RefineScenarioRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_message: str = Field(..., min_length=1, alias="userMessage")


class Workplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    address: str
    latitude: float
    longitude: float


class PreferenceProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    max_commute_minutes: int = Field(45, alias="maxCommuteMinutes")
    avoid_highways: bool = Field(False, alias="avoidHighways")
    max_transfers: int = Field(3, alias="maxTransfers")
    prefers_transit: bool = Field(False, alias="prefersTransit")
    prefers_driving: bool = Field(False, alias="prefersDriving")
    wants_quiet_area: bool = Field(False, alias="wantsQuietArea")


class CommuteAnalysis(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    drive_time_peak_minutes: int = Field(alias="driveTimePeakMinutes")
    transit_time_peak_minutes: int = Field(alias="transitTimePeakMinutes")
    walking_minutes_to_stop: int = Field(alias="walkingMinutesToStop")
    transfer_count: int = Field(alias="transferCount")
    congestion_level: float = Field(alias="congestionLevel")


class LifestyleAnalysis(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    walkability_score: int = Field(alias="walkabilityScore")
    grocery_score: int = Field(alias="groceryScore")
    park_score: int = Field(alias="parkScore")
    nightlife_score: int = Field(alias="nightlifeScore")
    quietness_score: int = Field(alias="quietnessScore")


class Zone(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    zone_id: str = Field(alias="zoneId")
    name: str
    boundary_geojson: str = Field(alias="boundaryGeoJson")
    center_lat: float = Field(alias="centerLat")
    center_lng: float = Field(alias="centerLng")


class Recommendation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rank: int
    total_score: float = Field(alias="totalScore")
    explanation_summary: str = Field("", alias="explanationSummary")
    zone: Zone
    commute_analysis: CommuteAnalysis = Field(alias="commuteAnalysis")
    lifestyle_analysis: LifestyleAnalysis = Field(alias="lifestyleAnalysis")


class ScenarioResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scenario_id: str = Field(alias="scenarioId")
    search_radius_miles: float = Field(alias="searchRadiusMiles")
    created_at: datetime = Field(alias="createdAt")
    status: ScenarioStatus
    workplace: Workplace
    preference_profile: PreferenceProfile = Field(alias="preferenceProfile")
    recommendations: list[Recommendation]


class RefineScenarioResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scenario: ScenarioResponse
    explanation_summary: str = Field(alias="explanationSummary")
