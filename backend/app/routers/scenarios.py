from fastapi import APIRouter, HTTPException

from app.repositories.scenario_store import get_scenario
from app.schemas.scenario import CreateScenarioRequest, ScenarioResponse
from app.services.scenario_service import create_scenario

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
