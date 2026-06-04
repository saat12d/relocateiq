import pytest

from app.schemas.scenario import PreferenceProfile, Workplace
from app.services.ai_explanation import generate_zone_summaries
from tests.test_recommendation_engine import _rec


@pytest.mark.asyncio
async def test_generate_zone_summaries_batches_all_recommendations(monkeypatch):
    batch_calls: list[int] = []

    async def _fake_batch(client, model, workplace, preferences, batch):
        batch_calls.append(len(batch))
        return [f"Summary for {rec.zone.name}" for rec in batch]

    monkeypatch.setattr(
        "app.services.ai_explanation._get_openai_client",
        lambda: (None, "gpt-4o-mini"),
    )
    monkeypatch.setattr(
        "app.services.ai_explanation._generate_batch_summaries",
        _fake_batch,
    )

    recommendations = [_rec(f"zone-{idx}", quietness=50 + idx) for idx in range(12)]
    workplace = Workplace(address="UCLA", latitude=34.0, longitude=-118.4)
    preferences = PreferenceProfile()

    summaries = await generate_zone_summaries(
        workplace=workplace,
        preferences=preferences,
        recommendations=recommendations,
        batch_size=5,
    )

    assert batch_calls == [5, 5, 2]
    assert len(summaries) == 12
    assert summaries[0] == "Summary for zone-0"
    assert summaries[-1] == "Summary for zone-11"
