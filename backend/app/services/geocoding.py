import os

import httpx

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"


class GeocodingError(Exception):
    pass


async def geocode_address(address: str) -> dict:
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        raise GeocodingError("GOOGLE_MAPS_API_KEY is not set")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            GEOCODING_URL,
            params={"address": address, "key": key},
        )

    if response.status_code != 200:
        raise GeocodingError(f"Geocoding HTTP {response.status_code}")

    payload = response.json()
    if payload.get("status") != "OK" or not payload.get("results"):
        raise GeocodingError("Address could not be geocoded")

    first = payload["results"][0]
    location = first["geometry"]["location"]
    return {
        "formatted_address": first["formatted_address"],
        "latitude": location["lat"],
        "longitude": location["lng"],
    }
