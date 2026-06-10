"""
Run from the backend directory:
    python scripts/test_connections.py

Requires a populated backend/.env file (copy .env.example and fill in keys).
"""

import os
import sys
import textwrap

import httpx
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

PASS = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"


def result(label: str, ok: bool, detail: str = "") -> None:
    icon = PASS if ok else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"  {icon}  {label}{suffix}")


# ── 1. Google Maps Geocoding API ──────────────────────────────────────────────
def test_google_maps() -> bool:
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        result("Google Maps", False, "key not set")
        return False
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    r = httpx.get(url, params={"address": "UCLA, Los Angeles, CA", "key": key}, timeout=10)
    ok = r.status_code == 200 and r.json().get("status") == "OK"
    result("Google Maps Geocoding", ok, r.json().get("status", r.status_code))
    return ok


# ── 2. Google Distance Matrix API ─────────────────────────────────────────────
def test_google_distance_matrix() -> bool:
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        result("Google Distance Matrix", False, "key not set")
        return False
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": "UCLA, Los Angeles, CA",
        "destinations": "Santa Monica, CA",
        "key": key,
    }
    r = httpx.get(url, params=params, timeout=10)
    ok = r.status_code == 200 and r.json().get("status") == "OK"
    result("Google Distance Matrix", ok, r.json().get("status", r.status_code))
    return ok


# ── 3. Walk Score API ─────────────────────────────────────────────────────────
def test_walkscore() -> bool:
    key = os.getenv("WALKSCORE_API_KEY", "")
    if not key or key.startswith("your_"):
        result("Walk Score", False, "key not set")
        return False
    r = httpx.get(
        "https://api.walkscore.com/score",
        params={
            "format": "json",
            "lat": 34.0689,
            "lon": -118.4452,
            "address": "UCLA, Los Angeles, CA",
            "wsapikey": key,
        },
        timeout=10,
    )
    data = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and data.get("status") == 1
    detail = f"walkscore={data.get('walkscore')}" if ok else str(data.get("status", r.status_code))
    result("Walk Score", ok, detail)
    return ok


# ── 4. Google Places API (New) ────────────────────────────────────────────────
def test_google_places() -> bool:
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or key.startswith("your_"):
        result("Google Places", False, "key not set")
        return False
    r = httpx.post(
        "https://places.googleapis.com/v1/places:searchNearby",
        json={
            "includedTypes": ["supermarket"],
            "maxResultCount": 1,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": 34.0689, "longitude": -118.4452},
                    "radius": 500.0,
                }
            },
        },
        headers={
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName",
        },
        timeout=10,
    )
    ok = r.status_code == 200
    result("Google Places (New)", ok, f"HTTP {r.status_code}")
    return ok


# ── 5. OpenAI Chat API ────────────────────────────────────────────────────────
def test_openai() -> bool:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key or key.startswith("your_"):
        result("OpenAI", False, "key not set")
        return False
    client = OpenAI(api_key=key)
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Reply with the single word: pong"}],
            max_tokens=5,
            timeout=15,
        )
        reply = resp.choices[0].message.content.strip().lower()
        ok = "pong" in reply
        result("OpenAI (gpt-4o-mini)", ok, f"replied: {reply!r}")
        return ok
    except Exception as exc:
        result("OpenAI (gpt-4o-mini)", False, str(exc))
        return False


# ── 6. RentCast Housing API ───────────────────────────────────────────────────
def test_housing_api() -> bool:
    key = os.getenv("RENTCAST_API_KEY", "")
    if not key or key.startswith("your_"):
        result("RentCast Housing", False, "key not set")
        return False
    # Sample rental listing search around Santa Monica
    url = "https://api.rentcast.io/v1/listings/rental/long-term"
    headers = {"X-Api-Key": key, "Accept": "application/json"}
    params = {"city": "Santa Monica", "state": "CA", "limit": 1}
    try:
        r = httpx.get(url, headers=headers, params=params, timeout=10)
        ok = r.status_code == 200
        detail = f"HTTP {r.status_code}"
        if ok:
            data = r.json()
            count = len(data) if isinstance(data, list) else 1
            detail += f" — {count} listing(s)"
        result("RentCast Housing", ok, detail)
        return ok
    except Exception as exc:
        result("RentCast Housing", False, str(exc))
        return False


# ── 7. Mapbox Styles API ──────────────────────────────────────────────────────
def test_mapbox() -> bool:
    token = os.getenv("MAPBOX_TOKEN", "")
    if not token or token.startswith("your_"):
        result("Mapbox", False, "token not set")
        return False
    # Hit the Mapbox styles endpoint to validate the token
    url = f"https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={token}"
    r = httpx.get(url, timeout=10)
    ok = r.status_code == 200
    result("Mapbox Styles API", ok, f"HTTP {r.status_code}")
    return ok


# ── 8. PostgreSQL ─────────────────────────────────────────────────────────────
def test_postgres() -> bool:
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url or "user:password" in db_url:
        result("PostgreSQL", False, "DATABASE_URL not configured")
        return False
    try:
        import psycopg2
        conn = psycopg2.connect(db_url, connect_timeout=5)
        conn.close()
        result("PostgreSQL", True, "connection OK")
        return True
    except Exception as exc:
        result("PostgreSQL", False, str(exc))
        return False


# ── Runner ────────────────────────────────────────────────────────────────────
TESTS = [
    ("Google Maps Platform", [test_google_maps, test_google_distance_matrix, test_google_places]),
    ("Walk Score",           [test_walkscore]),
    ("OpenAI",               [test_openai]),
    ("Housing (RentCast)",   [test_housing_api]),
    ("Mapbox",               [test_mapbox]),
    ("PostgreSQL",           [test_postgres]),
]

if __name__ == "__main__":
    print(textwrap.dedent("""
    ╔══════════════════════════════════════════╗
    ║   RelocateIQ — API Connection Tests      ║
    ╚══════════════════════════════════════════╝
    """))

    total, passed = 0, 0
    for group, fns in TESTS:
        print(f"[{group}]")
        for fn in fns:
            try:
                ok = fn()
            except Exception as exc:
                result(fn.__name__, False, str(exc))
                ok = False
            total += 1
            passed += int(ok)
        print()

    print(f"Results: {passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)
