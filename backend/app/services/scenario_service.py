from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from app.repositories.scenario_store import get_scenario, save_scenario, update_status
from app.schemas.scenario import (
    CreateScenarioRequest,
    PreferenceProfile,
    ScenarioResponse,
    ScenarioStatus,
    UpdatePreferencesRequest,
    Workplace,
)
from app.services.geocoding import GeocodingError, geocode_address
from app.services.recommendation_engine import (
    RecommendationEngineError,
    analyze_zones,
    rerank_with_preferences,
)
from app.services.zones import discover_zones


async def create_scenario(req: CreateScenarioRequest) -> ScenarioResponse:
    scenario_id = str(uuid4())
    preferences = PreferenceProfile()

    draft = ScenarioResponse(
        scenario_id=scenario_id,
        search_radius_miles=req.max_radius_miles,
        created_at=datetime.now(timezone.utc),
        status=ScenarioStatus.DRAFT,
        workplace=Workplace(address=req.workplace_address, latitude=0, longitude=0),
        preference_profile=preferences,
        recommendations=[],
    )
    save_scenario(draft)
    update_status(scenario_id, ScenarioStatus.SUBMITTED)

    try:
        geocoded = await geocode_address(req.workplace_address)
    except GeocodingError as exc:
        update_status(scenario_id, ScenarioStatus.DRAFT)
        raise HTTPException(status_code=400, detail=str(exc))

    submitted = ScenarioResponse(
        scenario_id=scenario_id,
        search_radius_miles=req.max_radius_miles,
        created_at=draft.created_at,
        status=ScenarioStatus.ANALYZING,
        workplace=Workplace(
            address=geocoded["formatted_address"],
            latitude=geocoded["latitude"],
            longitude=geocoded["longitude"],
        ),
        preference_profile=preferences,
        recommendations=[],
    )
    save_scenario(submitted)

    zones = discover_zones(
        workplace_lat=geocoded["latitude"],
        workplace_lng=geocoded["longitude"],
        max_radius_miles=req.max_radius_miles,
    )
    if not zones:
        raise HTTPException(status_code=422, detail="No candidate zones found in the selected radius")

    try:
        recommendations = await analyze_zones(
            raw_zones=zones,
            destination=geocoded["formatted_address"],
            preferences=preferences,
        )
    except RecommendationEngineError as exc:
        update_status(scenario_id, ScenarioStatus.FAILED)
        raise HTTPException(status_code=503, detail=str(exc))

    ranked = ScenarioResponse(
        scenario_id=scenario_id,
        search_radius_miles=req.max_radius_miles,
        created_at=draft.created_at,
        status=ScenarioStatus.RANKED,
        workplace=submitted.workplace,
        preference_profile=preferences,
        recommendations=recommendations,
    )
    save_scenario(ranked)
    return ranked


# [GenAI Use] Prompt: "Role: backend engineer fluent in Python, FastAPI, and Pydantic
# v2, with a strong grounding in REST semantics and layered service architecture.
# Context: A CommuteScenario already flows through a DRAFT -> SUBMITTED -> ANALYZING
# -> RANKED -> EXPLAINED state machine via create_scenario(); ranked recommendations
# carry cached CommuteAnalysis and LifestyleAnalysis payloads produced by the
# RecommendationEngine. Task: Implement the application-layer handler for
# PATCH /api/v1/scenarios/{id}/preferences as per the design doc: merge a partial
# PreferenceProfile patch onto the scenario, re-rank the cached recommendations
# against the new weights and the maxCommuteMinutes hard filter, and persist the
# result. Criteria: honor PATCH semantics (only mutate fields explicitly supplied,
# treating None as 'unchanged'); enforce the lifecycle precondition by mapping
# illegal source states to HTTP 409 and unknown ids to HTTP 404 at the boundary;
# preserve separation of concerns by delegating scoring to the RecommendationEngine
# (rerank_with_preferences) rather than duplicating weight math here; avoid any
# external I/O (no geocoder, no Distance Matrix calls) so the operation is fast,
# deterministic, and idempotent; keep the function pure-ish by operating on the
# deep-copied snapshot returned by get_scenario before writing back through
# save_scenario, so a mid-flight failure cannot corrupt the in-memory store."
# [GenAI Use] LLM Response Start
_UPDATABLE_STATUSES = {ScenarioStatus.RANKED, ScenarioStatus.EXPLAINED, ScenarioStatus.SAVED}


def update_preferences(scenario_id: str, req: UpdatePreferencesRequest) -> ScenarioResponse:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if scenario.status not in _UPDATABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Scenario is in {scenario.status.value} state and cannot be updated",
        )

    profile = scenario.preference_profile
    if req.prefers_transit is not None:
        profile.prefers_transit = req.prefers_transit
    if req.avoid_highways is not None:
        # TODO(avoid_highways): flag is persisted but does not yet influence ranking.
        # CommuteAnalysis carries no highway-usage signal and analyze_zones never
        # issues a Distance Matrix call with `avoid=highways`, so rerank_with_preferences
        # has nothing to weight on. To honor this preference we need either
        # (a) precompute a second drive-time variant with avoid=highways during
        # analyze_zones and pick between them here, or (b) re-issue the routing call
        # on PATCH when this flag flips (breaks the "no external I/O on update" guarantee).
        profile.avoid_highways = req.avoid_highways
    if req.max_commute_minutes is not None:
        profile.max_commute_minutes = req.max_commute_minutes

    scenario.recommendations = rerank_with_preferences(scenario.recommendations, profile)
    save_scenario(scenario)
    return scenario
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Mostly accepted as-is. Used a set for the state guard
# instead of listing each forbidden state. The rule is really 'do we have cached
# recommendations to re-rank,' and the set says that clearly. Added SAVED so the
# 'leave and come back' flow from US-2 keeps working. Did the merge with explicit
# `is not None` checks so passing `false` for avoidHighways actually toggles it off
# rather than being treated as 'unchanged.' avoidHighways doesn't influence
# ranking yet, so I left a TODO at the assignment with the two options."
