from fastapi import APIRouter, HTTPException

from app.repositories.scenario_store import get_scenario
from app.schemas.scenario import (
    CreateScenarioRequest,
    RefineScenarioRequest,
    RefineScenarioResponse,
    ScenarioResponse,
    UpdatePreferencesRequest,
)
from app.services.scenario_service import (
    create_scenario,
    explain_scenario,
    refine_scenario,
    update_preferences,
)

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioResponse, status_code=201)
async def generate_recommendations(req: CreateScenarioRequest) -> ScenarioResponse:
    return await create_scenario(req)


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def fetch_scenario(scenario_id: str) -> ScenarioResponse:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.patch("/{scenario_id}/preferences", response_model=ScenarioResponse)
async def update_scenario_preferences(
    scenario_id: str, req: UpdatePreferencesRequest
) -> ScenarioResponse:
    return update_preferences(scenario_id, req)


@router.post("/{scenario_id}/explain", response_model=ScenarioResponse)
async def explain_scenario_recommendations(scenario_id: str) -> ScenarioResponse:
    return await explain_scenario(scenario_id)


@router.post("/{scenario_id}/refine", response_model=RefineScenarioResponse)
async def refine_scenario_recommendations(
    scenario_id: str, req: RefineScenarioRequest
) -> RefineScenarioResponse:
    return await refine_scenario(scenario_id, req)
