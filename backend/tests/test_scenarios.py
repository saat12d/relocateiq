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
