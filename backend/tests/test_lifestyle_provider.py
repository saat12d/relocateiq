# [GenAI Use] Prompt: "Write pytest tests for StaticLifestyleProvider and
# static_scores(). westwood should return scores from lifestyle.json,
# unknown zones get 50s."
# [GenAI Use] LLM Response Start
import httpx
import pytest
import respx

import app.services.lifestyle as lifestyle_module
from app.services.lifestyle import (
    WALKSCORE_URL,
    StaticLifestyleProvider,
    fetch_walk_score,
    get_lifestyle_provider,
    normalize_batch,
    percentile_scores,
    score_places,
    static_scores,
)
from app.services.zones import load_lifestyle_scores


def test_static_provider_returns_json_scores():
    expected = load_lifestyle_scores()["westwood"]
    scores = static_scores("westwood")
    assert scores.walkability_score == expected["walkabilityScore"]
    assert scores.grocery_score == expected["groceryScore"]


def test_static_provider_defaults_unknown_zone():
    scores = static_scores("nowhere")
    assert scores.walkability_score == 50
    assert scores.quietness_score == 50


def test_factory_returns_static_provider():
    assert isinstance(get_lifestyle_provider(), StaticLifestyleProvider)


async def test_static_provider_get_scores():
    expected = static_scores("westwood")
    result = await StaticLifestyleProvider().get_scores(
        "westwood", 34.0635, -118.4455, "Westwood, Los Angeles, CA"
    )
    assert result.walkability_score == expected.walkability_score
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Pretty straightforward, just checking the JSON file loads right.


# [GenAI Use] Prompt: "Write pytest tests for score_places and normalize_batch."
# [GenAI Use] LLM Response Start
def test_score_places_buckets_types():
    places = [
        {"types": ["supermarket"], "location": {"latitude": 34.0635, "longitude": -118.4455}},
        {"types": ["park"], "location": {"latitude": 34.0636, "longitude": -118.4456}},
    ]
    grocery, park = score_places(places, 34.0635, -118.4455)
    assert grocery >= 5
    assert park >= 5


def test_percentile_scores_spreads_values():
    ranked = percentile_scores({"a": 1.0, "b": 5.0, "c": 10.0})
    assert ranked["a"] < ranked["b"] < ranked["c"]
    assert all(15 <= v <= 95 for v in ranked.values())


def test_normalize_batch_preserves_nightlife_and_quietness():
    existing = load_lifestyle_scores()
    raw = {
        "downtown-la": {"walk": 88, "grocery": 10.0, "park": 5.0},
        "playa-vista": {"walk": 72, "grocery": 1.0, "park": 15.0},
    }
    result = normalize_batch(raw, existing)
    assert result["downtown-la"].nightlife_score == existing["downtown-la"]["nightlifeScore"]
    assert result["downtown-la"].quietness_score == existing["downtown-la"]["quietnessScore"]
    assert result["playa-vista"].nightlife_score == existing["playa-vista"]["nightlifeScore"]
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Tested the math on its own so we didn't have to fake API calls.


# [GenAI Use] Prompt: "Write pytest tests for fetch_walk_score. Mock HTTP with respx."
# [GenAI Use] LLM Response Start
@pytest.fixture(autouse=True)
def _set_keys(monkeypatch):
    monkeypatch.setenv("WALKSCORE_API_KEY", "test-ws-key")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-google-key")


@respx.mock
async def test_fetch_walk_score_returns_parsed_score():
    respx.get(WALKSCORE_URL).mock(
        return_value=httpx.Response(200, json={"status": 1, "walkscore": 87})
    )
    assert await fetch_walk_score(34.06, -118.44, "Westwood, Los Angeles, CA") == 87


async def test_fetch_walk_score_raises_on_missing_key(monkeypatch):
    monkeypatch.delenv("WALKSCORE_API_KEY", raising=False)
    with pytest.raises(lifestyle_module.LifestyleError):
        await fetch_walk_score(34.06, -118.44, "Westwood, CA")


@respx.mock
async def test_fetch_walk_score_raises_on_http_error():
    respx.get(WALKSCORE_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(lifestyle_module.LifestyleError):
        await fetch_walk_score(34.06, -118.44, "Westwood, CA")
# [GenAI Use] LLM Response End
# [GenAI Use] Reflection: Faked the API responses so nothing actually hit the network. Nothing to change.
