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
