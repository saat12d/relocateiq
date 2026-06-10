# Backend (Python + FastAPI)

## Setup

1. Create a virtual environment:
   - `python3 -m venv .venv`
2. Activate it:
   - macOS/Linux: `source .venv/bin/activate`
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Copy env file:
   - `cp .env.example .env`

## Run

- `uvicorn app.main:app --reload --port 8000`

## Endpoints

- `GET /` basic service message
- `GET /health` health check
- `POST /api/v1/scenarios` create a commute scenario and rank neighborhoods
- `GET /api/v1/scenarios/{scenarioId}` fetch a scenario by id
- `GET /api/v1/zones/{zoneId}/listings` fetch housing listings for a zone
### Get zone listings
```bash
curl http://localhost:8000/api/v1/zones/westwood/listings
```
This returns '200' with an array full of the housing lisitings of this specific zone.  The listings are fethced from the static JSON throguh StaticListingProvider.  A zone with no listings return an empty list.  Build in a way that will make it a little easier to integrate a live housing API soon enough

### Create scenario

```bash
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Content-Type: application/json" \
  -d '{"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15}'
```

Returns `201` with `status: RANKED`, workplace coordinates, and ranked recommendations (commute metrics from Google, lifestyle scores from precomputed JSON).

Errors: `400` bad address, `422` invalid radius or no zones in range, `503` routing API failure.

## Lifestyle data

Lifestyle scores are **precomputed** in `app/data/lifestyle.json`:

- **Walkability** — Walk Score API
- **Grocery / park** — Google Places API (percentile-ranked across zones)
- **Nightlife / quietness** — hand-researched values in `lifestyle.json` (preserved when regenerating)

Commute stays live per user workplace; lifestyle is zone-level and does not need
to be refetched on every search.

Regenerate walk/grocery/park when APIs are configured (Walk Score + Places API New):

```bash
python scripts/generate_lifestyle.py
```

Restart the backend after regenerating — `lifestyle.json` is cached in memory.
