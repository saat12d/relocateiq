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


async def test_create_scenario_requires_auth():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/scenarios",
            json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15},
        )

    assert response.status_code in (401, 403)


@respx.mock
async def test_create_scenario_returns_ranked_recommendations(authenticated_client):
    client, _user_id = authenticated_client
    geocode_route = respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json=_geocode_ok_payload())
    )

    def matrix_response(request: httpx.Request) -> httpx.Response:
        mode = request.url.params.get("mode")
        if mode == "transit":
            return httpx.Response(200, json=_transit_matrix_payload())
        return httpx.Response(200, json=_drive_matrix_payload())

    matrix_route = respx.get(DISTANCE_MATRIX_URL).mock(side_effect=matrix_response)

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


async def test_create_scenario_rejects_invalid_radius(authenticated_client):
    client, _user_id = authenticated_client
    response = await client.post(
        "/api/v1/scenarios",
        json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 0.1},
    )

    assert response.status_code == 422


@respx.mock
async def test_create_scenario_returns_400_for_bad_address(authenticated_client):
    client, _user_id = authenticated_client
    respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []})
    )

    response = await client.post(
        "/api/v1/scenarios",
        json={"workplaceAddress": "not-a-real-address", "maxRadiusMiles": 10},
    )

    assert response.status_code == 400
    assert "could not be geocoded" in response.json()["detail"].lower()


@respx.mock
async def test_create_scenario_returns_503_when_matrix_fails(authenticated_client):
    client, _user_id = authenticated_client
    respx.get(GEOCODING_URL).mock(return_value=httpx.Response(200, json=_geocode_ok_payload()))
    respx.get(DISTANCE_MATRIX_URL).mock(return_value=httpx.Response(500))

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


@respx.mock
async def test_fetch_scenario_returns_404_for_other_user(authenticated_client):
    owner_client, _owner_id = authenticated_client
    scenario = await _create_ranked_scenario(owner_client)
    scenario_id = scenario["scenarioId"]

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as guest_client:
        other_signup = await guest_client.post(
            "/api/v1/auth/signup",
            json={
                "email": "other-user@example.com",
                "name": "Other User",
                "password": "password123",
            },
        )
        assert other_signup.status_code == 201
        other_token = other_signup.json()["access_token"]
        response = await guest_client.get(
            f"/api/v1/scenarios/{scenario_id}",
            headers={"Authorization": f"Bearer {other_token}"},
        )

    assert response.status_code == 404


@respx.mock
async def test_save_scenario_lists_only_saved_scenarios(authenticated_client):
    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]

    before_save = await client.get("/api/v1/scenarios")
    assert before_save.status_code == 200
    assert before_save.json() == []

    save_response = await client.post(f"/api/v1/scenarios/{scenario_id}/save")
    assert save_response.status_code == 200
    saved_payload = save_response.json()
    assert saved_payload["scenarioId"] == scenario_id
    assert saved_payload["status"] == "SAVED"

    saved_list = await client.get("/api/v1/scenarios")
    assert saved_list.status_code == 200
    payload = saved_list.json()
    assert [item["scenarioId"] for item in payload] == [scenario_id]
    assert payload[0]["status"] == "SAVED"


@respx.mock
async def test_list_scenarios_can_include_unsaved_searches(authenticated_client):
    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)

    response = await client.get("/api/v1/scenarios?saved_only=false")

    assert response.status_code == 200
    payload = response.json()
    assert [item["scenarioId"] for item in payload] == [scenario["scenarioId"]]
    assert payload[0]["status"] == "RANKED"


@respx.mock
async def test_save_scenario_returns_404_for_other_user(authenticated_client):
    owner_client, _owner_id = authenticated_client
    scenario = await _create_ranked_scenario(owner_client)
    scenario_id = scenario["scenarioId"]

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as guest_client:
        other_signup = await guest_client.post(
            "/api/v1/auth/signup",
            json={
                "email": "save-other-user@example.com",
                "name": "Other Save User",
                "password": "password123",
            },
        )
        assert other_signup.status_code == 201
        other_token = other_signup.json()["access_token"]
        response = await guest_client.post(
            f"/api/v1/scenarios/{scenario_id}/save",
            headers={"Authorization": f"Bearer {other_token}"},
        )

    assert response.status_code == 404


@respx.mock
async def test_update_preferences_reranks_and_filters_zones(authenticated_client):
    client, _user_id = authenticated_client
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
        assert rec["meetsFilters"] is True
        assert rec["commuteAnalysis"]["transitTimePeakMinutes"] <= 30


@respx.mock
async def test_update_preferences_dims_zones_exceeding_max_commute(authenticated_client):
    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]
    original_count = len(scenario["recommendations"])

    # Drive time from mock is 18 mins with traffic; cap at 5 fails every zone.
    # Zones are kept but flagged (dimmed) rather than dropped, so the filter is
    # reversible.
    response = await client.patch(
        f"/api/v1/scenarios/{scenario_id}/preferences",
        json={"maxCommuteMinutes": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["preferenceProfile"]["maxCommuteMinutes"] == 5
    assert len(payload["recommendations"]) == original_count
    assert all(rec["meetsFilters"] is False for rec in payload["recommendations"])
    assert all(rec["rank"] == 0 for rec in payload["recommendations"])


async def test_update_preferences_returns_404_for_unknown_scenario(authenticated_client):
    client, _user_id = authenticated_client
    response = await client.patch(
        "/api/v1/scenarios/does-not-exist/preferences",
        json={"prefersTransit": True},
    )

    assert response.status_code == 404


@respx.mock
async def test_update_preferences_rejects_out_of_range_max_commute(authenticated_client):
    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]

    response = await client.patch(
        f"/api/v1/scenarios/{scenario_id}/preferences",
        json={"maxCommuteMinutes": 200},
    )

    assert response.status_code == 422


async def test_update_preferences_returns_409_when_scenario_not_ranked(authenticated_client):
    client, user_id = authenticated_client
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
    save_scenario(draft, user_id)

    client, _user_id = authenticated_client
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

# [GenAI Use] Prompt: "Role: senior backend test engineer fluent in pytest, FastAPI,
# httpx ASGI transport, and pytest monkeypatch. Context: POST /api/v1/scenarios/{id}/explain
# transitions RANKED -> EXPLAINED and fills recommendation explanationSummary via
# generate_zone_summaries; POST /api/v1/scenarios/{id}/refine accepts userMessage,
# calls parse_refinement, patches PreferenceProfile, re-ranks cached recommendations,
# and returns RefineScenarioResponse with a top-level explanationSummary. Refine
# requires EXPLAINED or SAVED; ambiguous AI input returns 422 with clarifyingPrompt;
# OpenAI failures map to 502. Task: Add black-box integration tests that mock
# generate_zone_summaries and parse_refinement (no live OpenAI), reuse
# _create_ranked_scenario for setup, and cover happy paths plus 409/422/502 errors.
# Criteria: hermetic tests, Arrange-Act-Assert, assert HTTP contract and state
# machine preconditions, not implementation details of prompts."
# [GenAI Use] LLM Response Start
@respx.mock
async def test_explain_scenario_populates_explanations(authenticated_client, monkeypatch):
    async def _fake_generate_zone_summaries(**kwargs):
        recommendations = kwargs["recommendations"]
        return [f"Explanation for {rec.zone.name}" for rec in recommendations]

    monkeypatch.setattr(
        "app.services.scenario_service.generate_zone_summaries",
        _fake_generate_zone_summaries,
    )

    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]

    response = await client.post(f"/api/v1/scenarios/{scenario_id}/explain")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "EXPLAINED"
    assert payload["recommendations"][0]["explanationSummary"] != ""


async def test_explain_scenario_returns_409_when_not_ranked(authenticated_client):
    client, user_id = authenticated_client
    from app.repositories.scenario_store import save_scenario
    from app.schemas.scenario import (
        PreferenceProfile,
        ScenarioResponse,
        ScenarioStatus,
        Workplace,
    )
    from datetime import datetime, timezone

    draft = ScenarioResponse(
        scenario_id="analyzing-scenario",
        search_radius_miles=10,
        created_at=datetime.now(timezone.utc),
        status=ScenarioStatus.ANALYZING,
        workplace=Workplace(address="UCLA", latitude=34.0, longitude=-118.4),
        preference_profile=PreferenceProfile(),
        recommendations=[],
    )
    save_scenario(draft, user_id)

    response = await client.post("/api/v1/scenarios/analyzing-scenario/explain")

    assert response.status_code == 409


@respx.mock
async def test_refine_scenario_updates_profile_and_reranks(authenticated_client, monkeypatch):
    async def _fake_generate_zone_summaries(**kwargs):
        recommendations = kwargs["recommendations"]
        return [f"Explanation for {rec.zone.name}" for rec in recommendations]

    async def _fake_parse_refinement(**kwargs):
        return (
            {
                "wantsQuietArea": True,
                "prefersTransit": True,
                "maxCommuteMinutes": 30,
            },
            "I prioritized quieter neighborhoods and transit access.",
        )

    monkeypatch.setattr(
        "app.services.scenario_service.generate_zone_summaries",
        _fake_generate_zone_summaries,
    )
    monkeypatch.setattr(
        "app.services.scenario_service.parse_refinement",
        _fake_parse_refinement,
    )

    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]
    explain_response = await client.post(f"/api/v1/scenarios/{scenario_id}/explain")
    assert explain_response.status_code == 200

    response = await client.post(
        f"/api/v1/scenarios/{scenario_id}/refine",
        json={"userMessage": "I prefer quieter neighborhoods and transit options."},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["explanationSummary"] != ""
    assert payload["scenario"]["status"] == "EXPLAINED"
    assert payload["scenario"]["preferenceProfile"]["wantsQuietArea"] is True
    assert payload["scenario"]["preferenceProfile"]["prefersTransit"] is True
    assert payload["scenario"]["preferenceProfile"]["maxCommuteMinutes"] == 30


@respx.mock
async def test_refine_scenario_returns_422_when_clarification_required(
    authenticated_client,
    monkeypatch,
):
    from app.services.ai_explanation import AIClarificationRequired

    async def _fake_parse_refinement(**kwargs):
        raise AIClarificationRequired("Can you share whether transit or driving matters most?")

    monkeypatch.setattr(
        "app.services.scenario_service.parse_refinement",
        _fake_parse_refinement,
    )

    client, user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]

    from app.repositories.scenario_store import get_scenario, save_scenario
    from app.schemas.scenario import ScenarioStatus

    seeded = get_scenario(scenario_id, user_id)
    seeded.status = ScenarioStatus.EXPLAINED
    save_scenario(seeded, user_id)

    response = await client.post(
        f"/api/v1/scenarios/{scenario_id}/refine",
        json={"userMessage": "Make it better"},
    )

    assert response.status_code == 422
    assert "clarifyingPrompt" in response.json()["detail"]


@respx.mock
async def test_refine_scenario_returns_409_when_not_explained(authenticated_client):
    client, _user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]
    response = await client.post(
        f"/api/v1/scenarios/{scenario_id}/refine",
        json={"userMessage": "I want quieter neighborhoods."},
    )

    assert response.status_code == 409


@respx.mock
async def test_refine_scenario_returns_502_on_ai_failure(authenticated_client, monkeypatch):
    from app.services.ai_explanation import AIExplanationError

    async def _fake_parse_refinement(**kwargs):
        raise AIExplanationError("OpenAI timeout")

    monkeypatch.setattr(
        "app.services.scenario_service.parse_refinement",
        _fake_parse_refinement,
    )

    client, user_id = authenticated_client
    scenario = await _create_ranked_scenario(client)
    scenario_id = scenario["scenarioId"]

    from app.repositories.scenario_store import get_scenario, save_scenario
    from app.schemas.scenario import ScenarioStatus

    seeded = get_scenario(scenario_id, user_id)
    seeded.status = ScenarioStatus.EXPLAINED
    save_scenario(seeded, user_id)

    response = await client.post(
        f"/api/v1/scenarios/{scenario_id}/refine",
        json={"userMessage": "Prefer transit and quieter areas."},
    )

    assert response.status_code == 502
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Mocked AI at the scenario_service import path so tests stay
# offline, just like we learned in the testability lecture. Reused _create_ranked_scenario for explain/refine setup. Kept assertions on status codes and response fields from the
# public API contract rather than OpenAI payload shapes.

# [GenAI Use] Prompt: "Generate hermetic pytest tests for the optional departureTimeMinutes
# field on POST /api/v1/scenarios: assert it is forwarded to the Distance Matrix
# departure_time param, defaults to 8:00 AM when omitted, and is validated to [0, 1439].
# Also unit-test _next_weekday_epoch."
# [GenAI Use] LLM Response Start
def _captured_departure_matrix(captured: dict):
    """respx side-effect that records the departure_time param on each matrix call."""

    def _responder(request: httpx.Request) -> httpx.Response:
        captured["departure_time"] = request.url.params.get("departure_time")
        if request.url.params.get("mode") == "transit":
            return httpx.Response(200, json=_transit_matrix_payload())
        return httpx.Response(200, json=_drive_matrix_payload())

    return _responder


def test_next_weekday_epoch_uses_requested_time_of_day():
    import datetime as dt

    from app.services.recommendation_engine import _next_weekday_epoch

    target = dt.datetime.fromtimestamp(_next_weekday_epoch(hour=7, minute=30))

    assert target > dt.datetime.now()  # Google requires a future departure_time
    assert target.weekday() < 5  # Monday-Friday only
    assert target.hour == 7 and target.minute == 30


@respx.mock
async def test_create_scenario_forwards_departure_time_to_distance_matrix(authenticated_client):
    import datetime as dt
    client, _user_id = authenticated_client

    client, _user_id = authenticated_client
    respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json=_geocode_ok_payload())
    )
    captured: dict = {}
    respx.get(DISTANCE_MATRIX_URL).mock(side_effect=_captured_departure_matrix(captured))

    response = await client.post(
        "/api/v1/scenarios",
        json={
            "workplaceAddress": "UCLA, Los Angeles, CA",
            "maxRadiusMiles": 15,
            "departureTimeMinutes": 450,  # 7:30 AM
        },
    )

    assert response.status_code == 201
    assert captured["departure_time"] is not None
    forwarded = dt.datetime.fromtimestamp(int(captured["departure_time"]))
    assert forwarded.hour == 7 and forwarded.minute == 30
    assert forwarded.weekday() < 5


@respx.mock
async def test_create_scenario_defaults_departure_time_when_omitted(authenticated_client):
    import datetime as dt
    client, _user_id = authenticated_client

    client, _user_id = authenticated_client
    respx.get(GEOCODING_URL).mock(
        return_value=httpx.Response(200, json=_geocode_ok_payload())
    )
    captured: dict = {}
    respx.get(DISTANCE_MATRIX_URL).mock(side_effect=_captured_departure_matrix(captured))

    response = await client.post(
        "/api/v1/scenarios",
        json={"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15},
    )

    assert response.status_code == 201
    assert captured["departure_time"] is not None
    forwarded = dt.datetime.fromtimestamp(int(captured["departure_time"]))
    assert forwarded.hour == 8 and forwarded.minute == 0  # default rush hour


async def test_create_scenario_rejects_out_of_range_departure_time(authenticated_client):
    client, _user_id = authenticated_client
    too_late = await client.post(
        "/api/v1/scenarios",
        json={
            "workplaceAddress": "UCLA, Los Angeles, CA",
            "maxRadiusMiles": 15,
            "departureTimeMinutes": 1500,  # > 1439
        },
    )
    negative = await client.post(
        "/api/v1/scenarios",
        json={
            "workplaceAddress": "UCLA, Los Angeles, CA",
            "maxRadiusMiles": 15,
            "departureTimeMinutes": -10,
        },
    )

    assert too_late.status_code == 422
    assert negative.status_code == 422
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Asserted on the forwarded departure_time via a respx
# side-effect; kept _next_weekday_epoch assertions time-of-day-stable so CI never flakes.
