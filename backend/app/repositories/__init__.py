"""
Persistence layer for scenarios.

Services (like scenario_service) handle the workflow: geocode, rank, errors.
This folder is only for storing and fetching CommuteScenario data.

We use an in-memory dict for now. When we add Postgres, we should change
scenario_store (or add a new module here) without rewriting the rest of the API.
"""

from app.repositories.scenario_store import get_scenario, save_scenario, update_status

__all__ = ["get_scenario", "save_scenario", "update_status"]
