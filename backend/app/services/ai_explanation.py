import json
import os
from typing import Any

from openai import AsyncOpenAI

from app.schemas.scenario import PreferenceProfile, Recommendation, Workplace


class AIExplanationError(Exception):
    pass


class AIClarificationRequired(Exception):
    def __init__(self, clarifying_prompt: str):
        super().__init__(clarifying_prompt)
        self.clarifying_prompt = clarifying_prompt


def _get_openai_client() -> tuple[AsyncOpenAI, str]:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("your_"):
        raise AIExplanationError("OPENAI_API_KEY is missing or invalid")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return AsyncOpenAI(api_key=api_key), model


def _compact_zone_payload(recommendation: Recommendation) -> dict[str, Any]:
    commute = recommendation.commute_analysis
    lifestyle = recommendation.lifestyle_analysis
    return {
        "zoneName": recommendation.zone.name,
        "rank": recommendation.rank,
        "totalScore": recommendation.total_score,
        "commute": {
            "driveMinutes": commute.drive_time_peak_minutes,
            "transitMinutes": commute.transit_time_peak_minutes,
            "walkToStopMinutes": commute.walking_minutes_to_stop,
            "transferCount": commute.transfer_count,
            "congestionLevel": commute.congestion_level,
        },
        "lifestyle": {
            "walkabilityScore": lifestyle.walkability_score,
            "groceryScore": lifestyle.grocery_score,
            "parkScore": lifestyle.park_score,
            "nightlifeScore": lifestyle.nightlife_score,
            "quietnessScore": lifestyle.quietness_score,
        },
    }


async def generate_zone_summaries(
    workplace: Workplace,
    preferences: PreferenceProfile,
    recommendations: list[Recommendation],
    top_k: int = 5,
) -> list[str]:
    top_recs = recommendations[:top_k]
    if not top_recs:
        return []

    client, model = _get_openai_client()
    payload = {
        "workplaceAddress": workplace.address,
        "preferences": preferences.model_dump(by_alias=True),
        "recommendations": [_compact_zone_payload(rec) for rec in top_recs],
    }
    system_prompt = (
        "You are an assistant explaining ranked neighborhood recommendations. "
        "Return strict JSON with a top-level key `summaries` containing one short "
        "string per recommendation in input order. Each summary must be 1-2 sentences, "
        "grounded in provided metrics, and should not invent values."
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Generate recommendation explanations for this data:\n{json.dumps(payload)}",
                },
            ],
            temperature=0.2,
            timeout=20,
        )
    except Exception as exc:
        raise AIExplanationError(f"OpenAI request failed: {exc}") from exc

    content = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
        raw_summaries = parsed.get("summaries")
        if not isinstance(raw_summaries, list):
            raise ValueError("Missing summaries list")
        summaries = [str(item).strip() for item in raw_summaries if str(item).strip()]
    except Exception as exc:
        raise AIExplanationError(f"Failed to parse explanation response: {exc}") from exc

    if len(summaries) < len(top_recs):
        raise AIExplanationError("AI returned too few zone summaries")
    return summaries[: len(top_recs)]


async def parse_refinement(
    user_message: str,
    current_profile: PreferenceProfile,
    recommendations: list[Recommendation],
) -> tuple[dict[str, Any], str]:
    client, model = _get_openai_client()
    top_recs = recommendations[:5]
    payload = {
        "userMessage": user_message,
        "currentProfile": current_profile.model_dump(by_alias=True),
        "topRecommendations": [_compact_zone_payload(rec) for rec in top_recs],
    }
    system_prompt = (
        "You are extracting commute/lifestyle preference updates from natural language. "
        "Allowed profilePatch keys are: prefersTransit, prefersDriving, wantsQuietArea, "
        "avoidHighways, maxCommuteMinutes, maxTransfers. "
        "If the message is ambiguous or not actionable, return status=clarify with "
        "a short clarifyingPrompt. Otherwise return status=ok with profilePatch and "
        "explanationSummary (1-2 sentences on what changed). "
        "Return strict JSON only."
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.1,
            timeout=20,
        )
    except Exception as exc:
        raise AIExplanationError(f"OpenAI request failed: {exc}") from exc

    content = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
    except Exception as exc:
        raise AIExplanationError(f"Failed to parse refinement response: {exc}") from exc

    status = parsed.get("status")
    if status == "clarify":
        prompt = str(parsed.get("clarifyingPrompt", "")).strip()
        if not prompt:
            prompt = "Can you clarify which preferences matter most to you?"
        raise AIClarificationRequired(prompt)
    if status != "ok":
        raise AIExplanationError("AI returned invalid refinement status")

    patch = parsed.get("profilePatch")
    explanation_summary = str(parsed.get("explanationSummary", "")).strip()
    if not isinstance(patch, dict):
        raise AIExplanationError("AI returned invalid profilePatch")
    if not explanation_summary:
        raise AIExplanationError("AI returned empty explanationSummary")
    return patch, explanation_summary
