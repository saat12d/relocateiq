from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from app.repositories.scenario_store import save_scenario, update_status
from app.schemas.scenario import (
    CreateScenarioRequest,
    PreferenceProfile,
    ScenarioResponse,
    ScenarioStatus,
    Workplace,
)
from app.services.geocoding import GeocodingError, geocode_address
from app.services.recommendation_engine import RecommendationEngineError, analyze_zones
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
