import httpx
import pytest
import respx

from app.services.google_maps import (
    DISTANCE_MATRIX_URL,
    GoogleMapsError,
    get_drive_time,
)


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")


def _ok_payload(duration_seconds: int = 540, with_traffic: bool = False) -> dict:
    element = {
        "status": "OK",
        "distance": {"value": 5150, "text": "3.2 mi"},
        "duration": {"value": duration_seconds, "text": "9 mins"},
    }
    if with_traffic:
        element["duration_in_traffic"] = {"value": duration_seconds + 120, "text": "11 mins"}
    return {
        "status": "OK",
        "origin_addresses": ["Origin Resolved"],
        "destination_addresses": ["Destination Resolved"],
        "rows": [{"elements": [element]}],
    }


@respx.mock
async def test_get_drive_time_returns_parsed_fields():
    respx.get(DISTANCE_MATRIX_URL).mock(return_value=httpx.Response(200, json=_ok_payload()))

    result = await get_drive_time(origin="A", destination="B")

    assert result["origin_address"] == "Origin Resolved"
    assert result["destination_address"] == "Destination Resolved"
    assert result["distance_meters"] == 5150
    assert result["duration_seconds"] == 540
    assert result["duration_in_traffic_seconds"] is None


@respx.mock
async def test_get_drive_time_includes_traffic_when_departure_time_set():
    route = respx.get(DISTANCE_MATRIX_URL).mock(
        return_value=httpx.Response(200, json=_ok_payload(with_traffic=True))
    )

    result = await get_drive_time(origin="A", destination="B", departure_time=1_700_000_000)

    assert result["duration_in_traffic_seconds"] == 660
    sent_params = dict(route.calls.last.request.url.params)
    assert sent_params["departure_time"] == "1700000000"
    assert sent_params["traffic_model"] == "best_guess"


async def test_get_drive_time_raises_when_key_missing(monkeypatch):
    monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)
    with pytest.raises(GoogleMapsError, match="not set"):
        await get_drive_time(origin="A", destination="B")


@respx.mock
async def test_get_drive_time_raises_on_non_200():
    respx.get(DISTANCE_MATRIX_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(GoogleMapsError, match="HTTP 500"):
        await get_drive_time(origin="A", destination="B")


@respx.mock
async def test_get_drive_time_raises_on_api_status_error():
    respx.get(DISTANCE_MATRIX_URL).mock(
        return_value=httpx.Response(200, json={"status": "REQUEST_DENIED"})
    )
    with pytest.raises(GoogleMapsError, match="REQUEST_DENIED"):
        await get_drive_time(origin="A", destination="B")


@respx.mock
async def test_get_drive_time_raises_on_element_status_error():
    payload = _ok_payload()
    payload["rows"][0]["elements"][0] = {"status": "ZERO_RESULTS"}
    respx.get(DISTANCE_MATRIX_URL).mock(return_value=httpx.Response(200, json=payload))
    with pytest.raises(GoogleMapsError, match="ZERO_RESULTS"):
        await get_drive_time(origin="A", destination="B")
