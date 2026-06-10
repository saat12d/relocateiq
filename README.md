# RelocateIQ

**Smarter Relocation by Commute** — CS 130 Group 8, Spring 2026

RelocateIQ helps people relocating for work figure out where to live. Enter
your workplace address and a commute radius; the app ranks nearby
neighborhoods by commute quality (drive time, transit, traffic) and lifestyle
fit (walkability, groceries, parks, quietness), displays them on an
interactive map, lets you refine results with filters or natural language,
and surfaces real housing listings in the zones you like, all in one place.

## Project Structure

- `frontend/` — React single-page application (Vite, Mapbox GL JS)
- `backend/` — Python FastAPI service (PostgreSQL, SQLAlchemy, Alembic)

---

## Prerequisites

- **Node.js** (18+) and npm — for the frontend
- **Python 3.10+** — for the backend
- **PostgreSQL** — for the backend database (setup below)

---

## Frontend Setup (React)

1. `cd frontend`
2. `npm install`
3. `npm run dev`

Frontend runs at `http://localhost:5173`.

---

## Backend Setup (Python + PostgreSQL)

The backend needs a local PostgreSQL database, a configured `.env`, and
applied migrations before it will run. Follow these in order on first setup.

### 1. Install and start PostgreSQL (one-time)

**WSL / Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```
> Note: WSL does not auto-start services. Run `sudo service postgresql start`
> at the beginning of each work session. If the backend ever fails with
> "connection refused," Postgres probably isn't running — this command fixes it.

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```
> `brew services start` keeps Postgres running across restarts, so Mac users
> only need to do this once.

Verify it's running:
```bash
pg_isready
```
You should see `accepting connections`.

### 2. Create the project database and user (one-time)

```bash
sudo -u postgres psql        # WSL/Linux
# or on macOS (no sudo needed):  psql postgres
```

Then in the psql prompt:
```sql
CREATE USER relocateiq WITH PASSWORD 'devpassword';
CREATE DATABASE relocateiq OWNER relocateiq;
\q
```

Verify you can connect as the project user:
```bash
psql -U relocateiq -d relocateiq -h localhost
```
(Password: `devpassword`. You should land at a `relocateiq=>` prompt; `\q` to
exit.)

### 3. Create and activate a virtual environment

```bash
cd backend
python3 -m venv .venv          # one-time
source .venv/bin/activate      # every session (Windows: .venv\Scripts\activate)
```

Your prompt should show `(.venv)` when active.

### 4. Install Python dependencies

```bash
python -m pip install -r requirements.txt
```

> Tip: use `python -m pip` rather than bare `pip`. It guarantees packages
> install into the same interpreter that runs the app, avoiding a common
> WSL issue where `pip` and `python` point at different environments.

Re-run this whenever `requirements.txt` changes.

### 5. Configure your `.env` (one-time)

```bash
cp .env.example .env
```

Then open `.env` and fill in:

- **`DATABASE_URL`** — already pre-filled for the standard local setup
  (`postgresql://relocateiq:devpassword@localhost:5432/relocateiq`). Only
  change it if you used different Postgres credentials.
- **`JWT_SECRET`** — required for auth. Set it to any long random string.
  Generate one with:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
  The backend will refuse to start without it.
- **API keys** (`OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `TOMTOM_API_KEY`,
  `ZILLOW_API_KEY`) — needed for the recommendation/listings features. Get
  the shared dev keys from a teammate (shared privately — never committed).
  Auth and the basic app run without them; the external-data features won't.

> `.env` holds real secrets and is gitignored, never commit it.
> `.env.example` is the committed template with placeholders.

### 6. Apply database migrations

```bash
alembic upgrade head
```

This creates all tables (users, scenarios, zones, etc.) in your local
database. Re-run it whenever you pull changes that include new migrations.

> For creating new migrations and more detail on the migration workflow, see
> the [backend README](backend/README.md).

### 7. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.

- Interactive API docs (try endpoints in the browser):
  `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

## Daily startup (after first-time setup)

Once set up, a normal dev session is just:

```bash
# WSL only: make sure Postgres is running
sudo service postgresql start

# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

---

## Running the Tests

From `backend/` with the venv active:

```bash
pytest -v
```

This runs the full backend suite, auth (security, service, and endpoint
tests) and scenario tests. The auth tests use an isolated in-memory SQLite
database, so they never touch your local Postgres data.

To run a specific area only:

```bash
pytest tests/auth/ -v          # auth tests only
pytest tests/test_scenarios.py -v   # scenario tests only
```

Test configuration lives in `backend/pytest.ini` (test paths, async mode, and
the Python path are all set there — no extra setup needed).

---

## Tech Stack

- **Frontend:** React (Vite), Mapbox GL JS
- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic
- **Database:** PostgreSQL
- **Auth:** bcrypt password hashing, JWT bearer tokens (python-jose)
- **Testing:** pytest, pytest-asyncio, httpx (ASGI transport), in-memory
  SQLite for isolated auth tests
- **External services:** Google Maps (geocoding/routing), TomTom (traffic),
  Zillow (listings), OpenAI (AI preference refinement)