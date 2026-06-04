# [GenAI Use] Prompt: "Role: backend test engineer using pytest. Context: AI refine
# updates PreferenceProfile fields like wantsQuietArea and maxTransfers, then calls
# rerank_with_preferences on cached recommendations. We added quietness-weighted
# lifestyle scoring and a maxTransfers filter that flags zones with meets_filters=False
# instead of dropping them. Task: Write fast unit tests for rerank_with_preferences
# only — no HTTP, no Google mocks. Use small Recommendation factories. Cover:
# (1) wantsQuietArea flips rank order when a quieter zone has a worse commute,
# (2) transfer_count above max_transfers sets meets_filters=False and rank=0,
# (3) filtered zones stay in the returned list. Criteria: Arrange-Act-Assert, assert
# on rank and meets_filters invariants, not internal score math."
# [GenAI Use] LLM Response Start
from app.schemas.scenario import (
    CommuteAnalysis,
    LifestyleAnalysis,
    PreferenceProfile,
    Recommendation,
    Zone,
)
from app.services.recommendation_engine import rerank_with_preferences


def _zone(name: str) -> Zone:
    return Zone(
        zone_id=name,
        name=name,
        boundary_geojson="{}",
        center_lat=34.0,
        center_lng=-118.4,
    )


def _rec(
    name: str,
    *,
    quietness: int = 60,
    transfer_count: int = 1,
    drive_minutes: int = 20,
    transit_minutes: int = 30,
) -> Recommendation:
    return Recommendation(
        rank=0,
        total_score=0,
        zone=_zone(name),
        commute_analysis=CommuteAnalysis(
            drive_time_peak_minutes=drive_minutes,
            drive_time_no_highways_peak_minutes=drive_minutes + 2,
            transit_time_peak_minutes=transit_minutes,
            walking_minutes_to_stop=5,
            transfer_count=transfer_count,
            congestion_level=0.2,
        ),
        lifestyle_analysis=LifestyleAnalysis(
            walkability_score=70,
            grocery_score=70,
            park_score=70,
            nightlife_score=70,
            quietness_score=quietness,
        ),
    )


def test_wants_quiet_area_reranks_high_quietness_zones_first():
    # Loud zone wins on commute alone; quiet preference should flip the order.
    quiet = _rec("Brentwood", quietness=85, drive_minutes=28, transit_minutes=35)
    loud = _rec("Hollywood", quietness=30, drive_minutes=18, transit_minutes=25)
    default_profile = PreferenceProfile()

    default_ranked = rerank_with_preferences([loud, quiet], default_profile)
    quiet_profile = PreferenceProfile(wants_quiet_area=True)

    reranked = rerank_with_preferences([loud, quiet], quiet_profile)

    assert default_ranked[0].zone.name == "Hollywood"
    assert reranked[0].zone.name == "Brentwood"
    assert reranked[0].rank == 1
    assert reranked[1].zone.name == "Hollywood"
    assert reranked[1].rank == 2


def test_max_transfers_flags_zones_exceeding_cap():
    low_transfers = _rec("Westwood", transfer_count=0)
    high_transfers = _rec("Downtown", transfer_count=3)
    profile = PreferenceProfile(max_transfers=1, max_commute_minutes=60)

    ranked = rerank_with_preferences([high_transfers, low_transfers], profile)

    by_name = {rec.zone.name: rec for rec in ranked}
    assert by_name["Westwood"].meets_filters is True
    assert by_name["Westwood"].rank == 1
    assert by_name["Downtown"].meets_filters is False
    assert by_name["Downtown"].rank == 0


def test_max_transfers_does_not_remove_zones_from_results():
    low_transfers = _rec("Westwood", transfer_count=0)
    high_transfers = _rec("Downtown", transfer_count=3)
    profile = PreferenceProfile(max_transfers=0, max_commute_minutes=60)

    ranked = rerank_with_preferences([low_transfers, high_transfers], profile)

    assert len(ranked) == 2
    assert all(rec.zone.name in {"Westwood", "Downtown"} for rec in ranked)
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Kept these as pure unit tests with hand-built recommendations
# so we don't need a full scenario setup. Built the quiet-area case so the
# faster zone wins by default but loses once wantsQuietArea is on, that actually
# exercises the new weighting instead of just checking quietness was already higher.
