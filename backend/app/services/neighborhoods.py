import asyncio
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.services.google_maps import GoogleMapsError, get_drive_time

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "neighborhoods.json"

_commute_cache: dict[tuple[str, str], dict] = {}


@lru_cache(maxsize=1)
def load_neighborhoods() -> list[dict]:
    with _DATA_PATH.open() as f:
        return json.load(f)


def _normalize(addr: str) -> str:
    return " ".join(addr.strip().lower().split())


async def _commute_for(neighborhood: dict, work_address: str) -> Optional[dict]:
    key = (neighborhood["id"], _normalize(work_address))
    if key in _commute_cache:
        return _commute_cache[key]

    origin = f"{neighborhood['center']['lat']},{neighborhood['center']['lng']}"
    try:
        data = await get_drive_time(origin=origin, destination=work_address)
    except GoogleMapsError:
        return None

    commute = {
        "duration_seconds": data["duration_seconds"],
        "duration_text": data["duration_text"],
        "distance_text": data["distance_text"],
    }
    _commute_cache[key] = commute
    return commute


async def rank_by_commute(work_address: str, max_minutes: int) -> list[dict]:
    neighborhoods = load_neighborhoods()
    commutes = await asyncio.gather(
        *(_commute_for(n, work_address) for n in neighborhoods)
    )

    cutoff = max_minutes * 60
    ranked = [
        {"neighborhood": n, "commute": c}
        for n, c in zip(neighborhoods, commutes)
        if c is not None and c["duration_seconds"] <= cutoff
    ]
    ranked.sort(key=lambda x: x["commute"]["duration_seconds"])
    return ranked
