import asyncio
import datetime as dt

from app.schemas.scenario import (
    CommuteAnalysis,
    PreferenceProfile,
    Recommendation,
)
from app.services.google_maps import GoogleMapsError, get_drive_time, get_transit_time
from app.services.zones import get_lifestyle_analysis, to_zone_model


class RecommendationEngineError(Exception):
    pass


def _next_weekday_rush_hour_epoch() -> int:
    now = dt.datetime.now()
    target = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if target <= now:
        target = target + dt.timedelta(days=1)
    while target.weekday() >= 5:
        target = target + dt.timedelta(days=1)
    return int(target.timestamp())

# AI generated function (for now) to calculate the commute score based on the commute analysis.
def _commute_score(commute: CommuteAnalysis) -> float:
    drive = max(0.0, 100.0 - (commute.drive_time_peak_minutes * 1.8))
    transit = max(0.0, 100.0 - (commute.transit_time_peak_minutes * 1.2))
    transfers = max(0.0, 100.0 - (commute.transfer_count * 15))
    walk = max(0.0, 100.0 - (commute.walking_minutes_to_stop * 8))
    congestion = max(0.0, 100.0 - (commute.congestion_level * 100))
    return (drive * 0.32) + (transit * 0.32) + (transfers * 0.14) + (walk * 0.1) + (congestion * 0.12)


def _lifestyle_score(lifestyle) -> float:
    return (
        lifestyle.walkability_score
        + lifestyle.grocery_score
        + lifestyle.park_score
        + lifestyle.nightlife_score
        + lifestyle.quietness_score
    ) / 5


def _total_score(commute: CommuteAnalysis, lifestyle, preferences: PreferenceProfile) -> float:
    commute_weight = 0.65
    lifestyle_weight = 0.35
    if preferences.wants_quiet_area:
        commute_weight = 0.55
        lifestyle_weight = 0.45
    if preferences.prefers_transit:
        commute_weight = 0.72
        lifestyle_weight = 0.28
    return round(
        (_commute_score(commute) * commute_weight) + (_lifestyle_score(lifestyle) * lifestyle_weight),
        2,
    )


async def _build_recommendation(raw_zone: dict, destination: str, departure_time: int, preferences: PreferenceProfile) -> Recommendation:
    center = raw_zone["center"]
    origin = f"{center['lat']},{center['lng']}"

    drive_data, transit_data = await asyncio.gather(
        get_drive_time(origin=origin, destination=destination, departure_time=departure_time),
        get_transit_time(origin=origin, destination=destination, departure_time=departure_time),
    )

    traffic_seconds = drive_data["duration_in_traffic_seconds"] or drive_data["duration_seconds"]
    base_seconds = max(1, drive_data["duration_seconds"])
    congestion_level = min(max((traffic_seconds - base_seconds) / base_seconds, 0.0), 1.0)

    commute = CommuteAnalysis(
        drive_time_peak_minutes=max(1, round(traffic_seconds / 60)),
        transit_time_peak_minutes=max(1, round(transit_data["duration_seconds"] / 60)),
        walking_minutes_to_stop=5,
        transfer_count=1,
        congestion_level=round(congestion_level, 2),
    )
    lifestyle = get_lifestyle_analysis(raw_zone["id"])
    total = _total_score(commute, lifestyle, preferences)

    return Recommendation(
        rank=0,
        total_score=total,
        zone=to_zone_model(raw_zone),
        commute_analysis=commute,
        lifestyle_analysis=lifestyle,
        explanation_summary="",
    )


async def analyze_zones(raw_zones: list[dict], destination: str, preferences: PreferenceProfile) -> list[Recommendation]:
    departure_time = _next_weekday_rush_hour_epoch()
    try:
        recommendations = await asyncio.gather(
            *[
                _build_recommendation(
                    raw_zone=zone,
                    destination=destination,
                    departure_time=departure_time,
                    preferences=preferences,
                )
                for zone in raw_zones
            ]
        )
    except GoogleMapsError as exc:
        raise RecommendationEngineError(str(exc))

    ranked = sorted(recommendations, key=lambda item: item.total_score, reverse=True)
    for idx, item in enumerate(ranked, start=1):
        item.rank = idx
    return ranked
