"""Lifestyle scores from precomputed JSON; batch helpers for generate_lifestyle.py."""

import asyncio
import math
import os
from abc import ABC, abstractmethod

import httpx

from app.schemas.scenario import LifestyleAnalysis
from app.services.zones import load_lifestyle_scores

WALKSCORE_URL = "https://api.walkscore.com/score"
PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby"
_GROCERY_TYPES = ("supermarket", "grocery_store")
_PARK_TYPES = ("park",)
_GROCERY = frozenset(_GROCERY_TYPES)
_PARK = frozenset(_PARK_TYPES)


class LifestyleError(Exception):
    pass


def _default_scores() -> dict[str, int]:
    return {
        "walkabilityScore": 50,
        "groceryScore": 50,
        "parkScore": 50,
        "nightlifeScore": 50,
        "quietnessScore": 50,
    }


def static_scores(zone_id: str) -> LifestyleAnalysis:
    scores = load_lifestyle_scores().get(zone_id) or _default_scores()
    return LifestyleAnalysis(**scores)


def _dist_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def weighted_density(
    places: list[dict],
    lat: float,
    lng: float,
    *,
    match: frozenset[str],
) -> float:
    """Sum inverse-distance weights for places matching the given types."""
    total = 0.0
    for place in places:
        types = set(place.get("types") or [])
        if not types & match:
            continue
        loc = place.get("location") or {}
        dist = max(_dist_m(lat, lng, loc.get("latitude", lat), loc.get("longitude", lng)), 50.0)
        total += 1000.0 / dist
    return total


def score_places(places: list[dict], lat: float, lng: float) -> tuple[int, int]:
    """Score grocery/park density from a place list (used in tests)."""
    g = weighted_density(places, lat, lng, match=_GROCERY)
    p = weighted_density(places, lat, lng, match=_PARK)
    return _density_to_score(g), _density_to_score(p)


def _density_to_score(density: float) -> int:
    return max(10, min(100, round(density * 3)))


def percentile_scores(raw_by_zone: dict[str, float]) -> dict[str, int]:
    """Rank raw values across zones into comparable 15–95 scores."""
    if not raw_by_zone:
        return {}
    zones = list(raw_by_zone.keys())
    values = sorted(raw_by_zone[z] for z in zones)
    n = len(zones)
    if n == 1:
        return {zones[0]: 50}
    out: dict[str, int] = {}
    for zone_id, raw in raw_by_zone.items():
        below = sum(1 for v in values if v < raw)
        equal = sum(1 for v in values if v == raw)
        rank = below + (equal - 1) / 2
        pct = rank / (n - 1)
        out[zone_id] = round(15 + pct * 80)
    return out


def build_analysis(
    walk: int,
    grocery: int,
    park: int,
    nightlife: int,
    quietness: int,
) -> LifestyleAnalysis:
    return LifestyleAnalysis(
        walkability_score=walk,
        grocery_score=grocery,
        park_score=park,
        nightlife_score=nightlife,
        quietness_score=quietness,
    )


async def fetch_walk_score(lat: float, lng: float, address: str) -> int:
    key = os.getenv("WALKSCORE_API_KEY", "")
    if not key or key.startswith("your_"):
        raise LifestyleError("WALKSCORE_API_KEY not set")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            WALKSCORE_URL,
            params={"format": "json", "lat": lat, "lon": lng, "address": address, "wsapikey": key},
        )
    if r.status_code != 200:
        raise LifestyleError(f"Walk Score HTTP {r.status_code}")
    data = r.json()
    if data.get("status") != 1:
        raise LifestyleError(f"Walk Score status {data.get('status')}")
    return int(data["walkscore"])


async def fetch_places_by_types(lat: float, lng: float, types: tuple[str, ...]) -> list[dict]:
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        raise LifestyleError("GOOGLE_MAPS_API_KEY not set")
    radius = float(os.getenv("LIFESTYLE_SEARCH_RADIUS_M", "1000"))
    body = {
        "includedTypes": list(types),
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius},
        },
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            PLACES_URL,
            json=body,
            headers={
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "places.types,places.location",
            },
        )
    if r.status_code != 200:
        raise LifestyleError(f"Places HTTP {r.status_code}")
    return r.json().get("places") or []


async def fetch_zone_raw_metrics(lat: float, lng: float, address: str) -> dict[str, float | int]:
    """Walk score plus raw grocery/park densities from Places."""
    walk, grocery_places, park_places = await asyncio.gather(
        fetch_walk_score(lat, lng, address),
        fetch_places_by_types(lat, lng, _GROCERY_TYPES),
        fetch_places_by_types(lat, lng, _PARK_TYPES),
    )
    return {
        "walk": walk,
        "grocery": weighted_density(grocery_places, lat, lng, match=_GROCERY),
        "park": weighted_density(park_places, lat, lng, match=_PARK),
    }


def normalize_batch(
    raw_by_zone: dict[str, dict[str, float | int]],
    existing: dict[str, dict[str, int]] | None = None,
) -> dict[str, LifestyleAnalysis]:
    """Percentile-rank grocery/park; preserve nightlife/quietness from existing JSON."""
    prior = existing or {}
    grocery_ranked = percentile_scores({z: float(r["grocery"]) for z, r in raw_by_zone.items()})
    park_ranked = percentile_scores({z: float(r["park"]) for z, r in raw_by_zone.items()})
    result: dict[str, LifestyleAnalysis] = {}
    for zone_id, raw in raw_by_zone.items():
        kept = prior.get(zone_id) or _default_scores()
        result[zone_id] = build_analysis(
            walk=int(raw["walk"]),
            grocery=grocery_ranked[zone_id],
            park=park_ranked[zone_id],
            nightlife=kept["nightlifeScore"],
            quietness=kept["quietnessScore"],
        )
    return result


class LifestyleProvider(ABC):
    @abstractmethod
    async def get_scores(
        self, zone_id: str, lat: float, lng: float, address: str
    ) -> LifestyleAnalysis:
        raise NotImplementedError


class StaticLifestyleProvider(LifestyleProvider):
    async def get_scores(
        self, zone_id: str, lat: float, lng: float, address: str
    ) -> LifestyleAnalysis:
        return static_scores(zone_id)


def get_lifestyle_provider() -> LifestyleProvider:
    return StaticLifestyleProvider()
