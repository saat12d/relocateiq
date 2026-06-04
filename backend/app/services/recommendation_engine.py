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


def _next_weekday_epoch(hour: int = 8, minute: int = 0) -> int:
    """Epoch (seconds) for the next weekday at the given time of day.

    Google Distance Matrix requires departure_time to be in the future, and we
    want traffic/transit estimates for a normal commuting weekday, so we roll
    forward to the next Mon-Fri occurrence of the requested time.
    """
    now = dt.datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target = target + dt.timedelta(days=1)
    while target.weekday() >= 5:
        target = target + dt.timedelta(days=1)
    return int(target.timestamp())

# AI generated function (for now) to calculate the commute score based on the commute analysis.
def _commute_score(commute: CommuteAnalysis, preferences: PreferenceProfile) -> float:
    # When avoiding highways, score against the no-highway drive time instead.
    drive_minutes = (
        commute.drive_time_no_highways_peak_minutes
        if preferences.avoid_highways
        else commute.drive_time_peak_minutes
    )
    drive = max(0.0, 100.0 - (drive_minutes * 1.8))
    transit = max(0.0, 100.0 - (commute.transit_time_peak_minutes * 1.2))
    transfers = max(0.0, 100.0 - (commute.transfer_count * 15))
    walk = max(0.0, 100.0 - (commute.walking_minutes_to_stop * 8))
    congestion = max(0.0, 100.0 - (commute.congestion_level * 100))
    return (drive * 0.32) + (transit * 0.32) + (transfers * 0.14) + (walk * 0.1) + (congestion * 0.12)


def _lifestyle_score(lifestyle, preferences: PreferenceProfile) -> float:
    if preferences.wants_quiet_area:
        # When the user wants quiet areas, weight quietness at 40% of lifestyle score.
        return (
            lifestyle.quietness_score * 0.40
            + lifestyle.walkability_score * 0.15
            + lifestyle.grocery_score * 0.15
            + lifestyle.park_score * 0.15
            + lifestyle.nightlife_score * 0.15
        )
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
        (_commute_score(commute, preferences) * commute_weight)
        + (_lifestyle_score(lifestyle, preferences) * lifestyle_weight),
        2,
    )


async def _build_recommendation(raw_zone: dict, destination: str, departure_time: int, preferences: PreferenceProfile) -> Recommendation:
    center = raw_zone["center"]
    origin = f"{center['lat']},{center['lng']}"

    # Fetch the normal drive, the no-highway drive, and transit in parallel so the
    # avoid-highways filter can switch between drive times later without a new call.
    drive_data, no_highway_data, transit_data = await asyncio.gather(
        get_drive_time(origin=origin, destination=destination, departure_time=departure_time),
        get_drive_time(origin=origin, destination=destination, departure_time=departure_time, avoid="highways"),
        get_transit_time(origin=origin, destination=destination, departure_time=departure_time),
    )

    traffic_seconds = drive_data["duration_in_traffic_seconds"] or drive_data["duration_seconds"]
    base_seconds = max(1, drive_data["duration_seconds"])
    congestion_level = min(max((traffic_seconds - base_seconds) / base_seconds, 0.0), 1.0)
    no_highway_seconds = (
        no_highway_data["duration_in_traffic_seconds"] or no_highway_data["duration_seconds"]
    )

    commute = CommuteAnalysis(
        drive_time_peak_minutes=max(1, round(traffic_seconds / 60)),
        drive_time_no_highways_peak_minutes=max(1, round(no_highway_seconds / 60)),
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


# [GenAI Use] Prompt: "We're implementing the commute preference filters (transit-only,
# avoid highways, max commute time). The current rerank_with_preferences drops zones
# that exceed the max-commute cap, which makes the filter slider one-way: dragging it
# low permanently deletes zones. Rewrite it to be non-destructive so the slider is
# reversible: keep every recommendation, flag each one with meets_filters, and have the
# frontend dim the failing ones. The max-commute comparison should use transit time in
# transit-only mode, the no-highway drive time when avoid_highways is set, and the normal
# drive time otherwise. Qualifying zones rank 1..N by score; non-qualifying get rank 0."
# [GenAI Use] LLM Response Start
def _relevant_commute_minutes(rec: Recommendation, preferences: PreferenceProfile) -> int:
    """The commute time the max-commute filter compares against, given the mode."""
    if preferences.prefers_transit:
        return rec.commute_analysis.transit_time_peak_minutes
    if preferences.avoid_highways:
        return rec.commute_analysis.drive_time_no_highways_peak_minutes
    return rec.commute_analysis.drive_time_peak_minutes


def _meets_filters(rec: Recommendation, preferences: PreferenceProfile) -> bool:
    if _relevant_commute_minutes(rec, preferences) > preferences.max_commute_minutes:
        return False
    if rec.commute_analysis.transfer_count > preferences.max_transfers:
        return False
    return True


def rerank_with_preferences(
    recommendations: list[Recommendation],
    preferences: PreferenceProfile,
) -> list[Recommendation]:
    # Keep every zone so filters stay reversible. Zones that fail active filters
    # are flagged meets_filters=False (the frontend dims them) rather than dropped.
    # Qualifying zones sort first by score and get ranks 1..N; the rest keep
    # their score order but get rank 0.
    for rec in recommendations:
        rec.total_score = _total_score(rec.commute_analysis, rec.lifestyle_analysis, preferences)
        rec.meets_filters = _meets_filters(rec, preferences)
    ranked = sorted(
        recommendations,
        key=lambda item: (item.meets_filters, item.total_score),
        reverse=True,
    )
    rank = 0
    for item in ranked:
        if item.meets_filters:
            rank += 1
            item.rank = rank
        else:
            item.rank = 0
    return ranked
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Accepted as written. Filtering now flags zones with
# meets_filters instead of deleting them, so moving the slider back up brings hidden
# zones back. The no-highway time is computed earlier in analyze_zones, so changing a
# filter re-ranks without calling the routing API again.


async def analyze_zones(
    raw_zones: list[dict],
    destination: str,
    preferences: PreferenceProfile,
    departure_time_minutes: int | None = None,
) -> list[Recommendation]:
    if departure_time_minutes is None:
        departure_time = _next_weekday_epoch()
    else:
        departure_time = _next_weekday_epoch(
            hour=departure_time_minutes // 60,
            minute=departure_time_minutes % 60,
        )
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

    # Rank and flag against the (default) preferences so meets_filters is set from
    # the start, keeping initial results consistent with later filter updates.
    return rerank_with_preferences(list(recommendations), preferences)
