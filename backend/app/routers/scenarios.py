from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.db.models import User
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
    list_user_scenarios,
    refine_scenario,
    save_user_scenario,
    update_preferences,
)

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioResponse, status_code=201)
async def generate_recommendations(
    req: CreateScenarioRequest,
    user: User = Depends(get_current_user),
) -> ScenarioResponse:
    return await create_scenario(req, user.user_id)


@router.get("", response_model=list[ScenarioResponse])
async def list_current_user_scenarios(
    saved_only: bool = True,
    user: User = Depends(get_current_user),
) -> list[ScenarioResponse]:
    return list_user_scenarios(user.user_id, saved_only=saved_only)


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def fetch_scenario(
    scenario_id: str,
    user: User = Depends(get_current_user),
) -> ScenarioResponse:
    scenario = get_scenario(scenario_id, user.user_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.patch("/{scenario_id}/preferences", response_model=ScenarioResponse)
async def update_scenario_preferences(
    scenario_id: str,
    req: UpdatePreferencesRequest,
    user: User = Depends(get_current_user),
) -> ScenarioResponse:
    return update_preferences(scenario_id, req, user.user_id)


@router.post("/{scenario_id}/save", response_model=ScenarioResponse)
async def save_scenario_for_later(
    scenario_id: str,
    user: User = Depends(get_current_user),
) -> ScenarioResponse:
    return save_user_scenario(scenario_id, user.user_id)


@router.post("/{scenario_id}/explain", response_model=ScenarioResponse)
async def explain_scenario_recommendations(
    scenario_id: str,
    user: User = Depends(get_current_user),
) -> ScenarioResponse:
    return await explain_scenario(scenario_id, user.user_id)


@router.post("/{scenario_id}/refine", response_model=RefineScenarioResponse)
async def refine_scenario_recommendations(
    scenario_id: str,
    req: RefineScenarioRequest,
    user: User = Depends(get_current_user),
) -> RefineScenarioResponse:
    return await refine_scenario(scenario_id, req, user.user_id)
