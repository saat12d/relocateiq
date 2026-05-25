import httpx
import pytest
import respx

from app.main import app
from app.services.geocoding import GEOCODING_URL
from app.services.google_maps import DISTANCE_MATRIX_URL

# AI generated tests for scenario API. Prompt - "Generate tests for the scenario API endpoints, based on the design document."

@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")


def _geocode_ok_payload() -> dict:
    return {
        "status": "OK",
        "results": [
            {
                "formatted_address": "UCLA, Los Angeles, CA, USA",
                "geometry": {"location": {"lat": 34.0689, "lng": -118.4452}},
            }
        ],
    }


def _drive_matrix_payload() -> dict:
    return {
        "status": "OK",
        "origin_addresses": ["Westwood"],
        "destination_addresses": ["UCLA, Los Angeles, CA, USA"],
        "rows": [
            {
                "elements": [
                    {
                        "status": "OK",
                        "distance": {"value": 5000, "text": "3.1 mi"},
                        "duration": {"value": 900, "text": "15 mins"},
                        "duration_in_traffic": {"value": 1080, "text": "18 mins"},
                    }
                ]
            }
        ],
    }


def _transit_matrix_payload() -> dict:
    return {
        "status": "OK",
        "origin_addresses": ["Westwood"],
        "destination_addresses": ["UCLA, Los Angeles, CA, USA"],
        "rows": [
            {
                "elements": [
                    {
                        "status": "OK",
                        "distance": {"value": 5200, "text": "3.2 mi"},
                        "duration": {"value": 1620, "text": "27 mins"},
                    }
                ]
            }
        ],
    }


@respx.mock
async def test_create_scenario_returns_ranked_recommendations():
    geocode_route = respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json=_geocode_ok_payload())
    )

    def matrix_response(request: httpx.Request) -> httpx.Response:
        mode = request.url.params.get("mode")
        if mode == "transit":
            return httpx.Response(200, json=_transit_matrix_payload())
        return httpx.Response(200, json=_drive_matrix_payload())

    matrix_route = respx.get(DISTANCE_MATRIX_URL).mock(side_effect=matrix_response)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/scenarios",
            json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15},
        )

    assert geocode_route.called
    assert matrix_route.called
    assert response.status_code == 201

    payload = response.json()
    assert payload["status"] == "RANKED"
    assert len(payload["recommendations"]) > 0
    assert payload["recommendations"][0]["rank"] == 1
    assert "lifestyleAnalysis" in payload["recommendations"][0]
    assert "commuteAnalysis" in payload["recommendations"][0]


async def test_create_scenario_rejects_invalid_radius():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/scenarios",
            json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 0.1},
        )

    assert response.status_code == 422


@respx.mock
async def test_create_scenario_returns_400_for_bad_address():
    respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []})
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/scenarios",
            json={"workplaceAddress": "not-a-real-address", "maxRadiusMiles": 10},
        )

    assert response.status_code == 400
    assert "could not be geocoded" in response.json()["detail"].lower()


@respx.mock
async def test_create_scenario_returns_503_when_matrix_fails():
    respx.get(GEOCODING_URL).mock(return_value=httpx.Response(200, json=_geocode_ok_payload()))
    respx.get(DISTANCE_MATRIX_URL).mock(return_value=httpx.Response(500))

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/scenarios",
            json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15},
        )

    assert response.status_code == 503

# [GenAI Use] Prompt: "Role: senior backend test engineer fluent in pytest, FastAPI,
# and the respx HTTP mocking library. Context: I am adding integration tests for a
# PATCH /api/v1/scenarios/{id}/preferences endpoint that mutates a PreferenceProfile
# and re-ranks cached zone recommendations. The endpoint is gated by a state machine
# (only RANKED/EXPLAINED/SAVED scenarios are mutable) and validates maxCommuteMinutes
# against a [5, 60] range. Task: Design a black-box test suite against the public
# HTTP contract that exercises the happy path plus each documented error response
# (404 unknown scenario, 409 illegal state transition, 422 schema/range violation).
# Criteria: Apply the FIRST principles (Fast, Independent, Repeatable,
# Self-validating, Timely); follow Arrange-Act-Assert; use boundary-value analysis
# for the maxCommuteMinutes range and equivalence partitioning across scenario
# states; isolate the system under test from Google Maps and the geocoder via respx
# so tests stay hermetic; reuse a factory helper to seed a ranked scenario without
# duplicating mock wiring; assert on response invariants (rank monotonicity,
# filter post-conditions) rather than incidental ordering."
@respx.mock
async def _create_ranked_scenario(client: httpx.AsyncClient) -> dict:
    respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json=_geocode_ok_payload())
    )

    def matrix_response(request: httpx.Request) -> httpx.Response:
        mode = request.url.params.get("mode")
        if mode == "transit":
            return httpx.Response(200, json=_transit_matrix_payload())
        return httpx.Response(200, json=_drive_matrix_payload())

    respx.get(DISTANCE_MATRIX_URL).mock(side_effect=matrix_response)

    response = await client.post(
        "/api/v1/scenarios",
        json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15},
    )
    assert response.status_code == 201
    return response.json()


async def test_update_preferences_reranks_and_filters_zones():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        scenario = await _create_ranked_scenario(client)
        scenario_id = scenario["scenarioId"]
        original_count = len(scenario["recommendations"])
        assert original_count > 0

        response = await client.patch(
            f"/api/v1/scenarios/{scenario_id}/preferences",
            json={"prefersTransit": True, "avoidHighways": True, "maxCommuteMinutes": 30},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["preferenceProfile"]["prefersTransit"] is True
    assert payload["preferenceProfile"]["avoidHighways"] is True
    assert payload["preferenceProfile"]["maxCommuteMinutes"] == 30
    # Transit time from mock is 27 mins, under the 30-min cap, so all should remain.
    assert len(payload["recommendations"]) == original_count
    for idx, rec in enumerate(payload["recommendations"], start=1):
        assert rec["rank"] == idx
        assert rec["commuteAnalysis"]["transitTimePeakMinutes"] <= 30


async def test_update_preferences_removes_zones_exceeding_max_commute():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        scenario = await _create_ranked_scenario(client)
        scenario_id = scenario["scenarioId"]

        # Drive time from mock is 18 mins with traffic; cap at 5 should remove everything.
        response = await client.patch(
            f"/api/v1/scenarios/{scenario_id}/preferences",
            json={"maxCommuteMinutes": 5},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["preferenceProfile"]["maxCommuteMinutes"] == 5
    assert payload["recommendations"] == []


async def test_update_preferences_returns_404_for_unknown_scenario():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.patch(
            "/api/v1/scenarios/does-not-exist/preferences",
            json={"prefersTransit": True},
        )

    assert response.status_code == 404


async def test_update_preferences_rejects_out_of_range_max_commute():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        scenario = await _create_ranked_scenario(client)
        scenario_id = scenario["scenarioId"]

        response = await client.patch(
            f"/api/v1/scenarios/{scenario_id}/preferences",
            json={"maxCommuteMinutes": 120},
        )

    assert response.status_code == 422


async def test_update_preferences_returns_409_when_scenario_not_ranked():
    from app.repositories.scenario_store import save_scenario
    from app.schemas.scenario import (
        PreferenceProfile,
        ScenarioResponse,
        ScenarioStatus,
        Workplace,
    )
    from datetime import datetime, timezone

    draft = ScenarioResponse(
        scenario_id="draft-scenario",
        search_radius_miles=10,
        created_at=datetime.now(timezone.utc),
        status=ScenarioStatus.ANALYZING,
        workplace=Workplace(address="UCLA", latitude=34.0, longitude=-118.4),
        preference_profile=PreferenceProfile(),
        recommendations=[],
    )
    save_scenario(draft)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.patch(
            "/api/v1/scenarios/draft-scenario/preferences",
            json={"prefersTransit": True},
        )

    assert response.status_code == 409

# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Checked each documented error code has a test. Kept the
# respx helper so every test stands up its own scenario instead of sharing state.
# Picked maxCommuteMinutes=5 for the filter test because the mocked drive time is
# 18 min, so that cap evicts everything and covers the empty-result branch. The
# 409 test seeds an ANALYZING scenario straight into the repo to avoid dragging
# the full geocoding pipeline into a state-guard check.