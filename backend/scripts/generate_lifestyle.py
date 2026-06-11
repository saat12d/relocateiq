"""
Batch-generate app/data/lifestyle.json from Walk Score + Google Places.

- Walkability: Walk Score API
- Grocery / park: Google Places (percentile-ranked across zones)
- Nightlife / quietness: preserved from existing lifestyle.json (hand-researched)

Run from backend/ with keys in .env:
    python scripts/generate_lifestyle.py

Restart the backend after regenerating (lifestyle.json is cached in memory).
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.lifestyle import (  # noqa: E402
    LifestyleError,
    _default_scores,
    fetch_zone_raw_metrics,
    normalize_batch,
)
from app.services.zones import load_lifestyle_scores, load_neighborhoods  # noqa: E402

LIFESTYLE_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "lifestyle.json"
ZONE_DELAY_S = float(os.getenv("LIFESTYLE_GENERATE_DELAY_S", "0.5"))


def _zone_address(zone: dict) -> str:
    return f"{zone['name']}, {zone['city']}, {zone['state']}"


async def _generate() -> int:
    existing = load_lifestyle_scores()
    raw_by_zone: dict[str, dict] = {}
    failures = 0

    for zone in load_neighborhoods():
        zone_id = zone["id"]
        center = zone["center"]
        lat, lng = center["lat"], center["lng"]
        try:
            raw_by_zone[zone_id] = await fetch_zone_raw_metrics(lat, lng, _zone_address(zone))
            print(f"  ok  {zone_id}")
        except (LifestyleError, Exception) as exc:
            failures += 1
            print(f"  --  {zone_id} (skipped: {exc})")
        await asyncio.sleep(ZONE_DELAY_S)

    normalized = normalize_batch(raw_by_zone, existing)
    output: dict[str, dict] = {}
    for zone in load_neighborhoods():
        zone_id = zone["id"]
        if zone_id in normalized:
            output[zone_id] = normalized[zone_id].model_dump(by_alias=True)
        else:
            output[zone_id] = existing.get(zone_id) or _default_scores()

    LIFESTYLE_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"\nWrote {len(output)} zones to {LIFESTYLE_PATH}")
    print(f"Normalized {len(normalized)} zones across batch percentiles")
    print(f"Generated at {datetime.now(timezone.utc).isoformat()}")
    print("Restart the backend to pick up new scores (lifestyle.json is cached).")
    return failures


if __name__ == "__main__":
    print("Generating lifestyle.json from Walk Score + Google Places...\n")
    failed = asyncio.run(_generate())
    sys.exit(1 if failed else 0)
