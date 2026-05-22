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

### Create scenario

```bash
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Content-Type: application/json" \
  -d '{"workplaceAddress": "UCLA, Los Angeles, CA", "maxRadiusMiles": 15}'
```

Returns `201` with `status: RANKED`, workplace coordinates, and ranked recommendations (commute metrics from Google, lifestyle scores from static JSON).

Errors: `400` bad address, `422` invalid radius or no zones in range, `503` routing API failure.
