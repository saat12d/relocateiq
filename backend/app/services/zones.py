import json
import math
from functools import lru_cache
from pathlib import Path

from app.schemas.scenario import LifestyleAnalysis, Zone

NEIGHBORHOODS_PATH = Path(__file__).resolve().parent.parent / "data" / "neighborhoods.json"
LIFESTYLE_PATH = Path(__file__).resolve().parent.parent / "data" / "lifestyle.json"
EARTH_RADIUS_MILES = 3958.8


@lru_cache(maxsize=1)
def load_neighborhoods() -> list[dict]:
    with NEIGHBORHOODS_PATH.open() as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_lifestyle_scores() -> dict:
    with LIFESTYLE_PATH.open() as handle:
        return json.load(handle)


def _miles_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_MILES * c


def _build_boundary_geojson(center_lat: float, center_lng: float) -> str:
    lat_delta = 0.018
    lng_delta = 0.018
    points = [
        [center_lng - lng_delta, center_lat - lat_delta],
        [center_lng + lng_delta, center_lat - lat_delta],
        [center_lng + lng_delta, center_lat + lat_delta],
        [center_lng - lng_delta, center_lat + lat_delta],
        [center_lng - lng_delta, center_lat - lat_delta],
    ]
    return json.dumps({"type": "Polygon", "coordinates": [points]})


def discover_zones(workplace_lat: float, workplace_lng: float, max_radius_miles: float) -> list[dict]:
    neighborhoods = load_neighborhoods()
    filtered: list[tuple[dict, float]] = []

    for zone in neighborhoods:
        center = zone["center"]
        distance = _miles_between(workplace_lat, workplace_lng, center["lat"], center["lng"])
        if distance <= max_radius_miles:
            filtered.append((zone, distance))

    filtered.sort(key=lambda item: item[1])
    return [item[0] for item in filtered[:20]]


def to_zone_model(raw_zone: dict) -> Zone:
    center = raw_zone["center"]
    return Zone(
        zone_id=raw_zone["id"],
        name=raw_zone["name"],
        boundary_geojson=_build_boundary_geojson(center["lat"], center["lng"]),
        center_lat=center["lat"],
        center_lng=center["lng"],
    )


def get_lifestyle_analysis(zone_id: str) -> LifestyleAnalysis:
    scores = load_lifestyle_scores().get(zone_id)
    if scores is None:
        scores = {
            "walkabilityScore": 50,
            "groceryScore": 50,
            "parkScore": 50,
            "nightlifeScore": 50,
            "quietnessScore": 50,
        }
    return LifestyleAnalysis(**scores)
