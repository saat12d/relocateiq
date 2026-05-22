from copy import deepcopy

from app.schemas.scenario import ScenarioResponse, ScenarioStatus

_store: dict[str, ScenarioResponse] = {}


def save_scenario(scenario: ScenarioResponse) -> None:
    _store[scenario.scenario_id] = scenario


def get_scenario(scenario_id: str) -> ScenarioResponse | None:
    scenario = _store.get(scenario_id)
    if scenario is None:
        return None
    return deepcopy(scenario)


def update_status(scenario_id: str, status: ScenarioStatus) -> ScenarioResponse | None:
    scenario = _store.get(scenario_id)
    if scenario is None:
        return None
    scenario.status = status
    return deepcopy(scenario)
