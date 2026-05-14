import os
from typing import Optional

import httpx

DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


class GoogleMapsError(Exception):
    pass


async def get_drive_time(
    origin: str,
    destination: str,
    departure_time: Optional[int] = None,
) -> dict:
    """Call Google Distance Matrix for a single origin/destination pair.

    Returns a dict with duration_seconds, duration_in_traffic_seconds (if available),
    distance_meters, and the resolved address strings.
    """
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        raise GoogleMapsError("GOOGLE_MAPS_API_KEY is not set")

    params: dict[str, str] = {
        "origins": origin,
        "destinations": destination,
        "key": key,
        "mode": "driving",
        "units": "imperial",
    }
    if departure_time is not None:
        # Google requires either a future epoch or the literal "now" for traffic data.
        params["departure_time"] = str(departure_time)
        params["traffic_model"] = "best_guess"

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(DISTANCE_MATRIX_URL, params=params)

    if r.status_code != 200:
        raise GoogleMapsError(f"Distance Matrix HTTP {r.status_code}")

    data = r.json()
    if data.get("status") != "OK":
        raise GoogleMapsError(f"Distance Matrix status: {data.get('status')}")

    element = data["rows"][0]["elements"][0]
    if element.get("status") != "OK":
        raise GoogleMapsError(f"Route status: {element.get('status')}")

    return {
        "origin_address": data["origin_addresses"][0],
        "destination_address": data["destination_addresses"][0],
        "distance_meters": element["distance"]["value"],
        "distance_text": element["distance"]["text"],
        "duration_seconds": element["duration"]["value"],
        "duration_text": element["duration"]["text"],
        "duration_in_traffic_seconds": element.get("duration_in_traffic", {}).get("value"),
        "duration_in_traffic_text": element.get("duration_in_traffic", {}).get("text"),
    }
