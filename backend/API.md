# RelocateIQ Backend — API Documentation


This document describes every REST endpoint exposed by the RelocateIQ backend. It follows the same structure we used in the design doc - each endpoint gets **Semantics**, **Params**, **Pre-conditions**, **Post-conditions**, and **Errors** — so TAs (and teammates) can read one section and understand what the call is supposed to do without digging through router code.

---

## Overview

RelocateIQ is a layered FastAPI service. The frontend talks to `/api/v1/*` routes; those routes validate input, orchestrate the recommendation pipeline, and return JSON. Scenario and listing payloads use **camelCase** field names to match the React client (`workplaceAddress`, `scenarioId`, `maxCommuteMinutes`, etc.). Auth token responses use **snake_case** (`access_token`, `token_type`) as defined in `TokenResponse`. The legacy `/commute` and `/neighborhoods` helpers also use snake_case.

### Authentication

Most `/api/v1/scenarios` and `/api/v1/zones` routes require a logged-in user. Send the JWT from signup/login as a Bearer token:

```http
Authorization: Bearer <access_token>
```

Auth endpoints (`/api/v1/auth/signup`, `/api/v1/auth/login`) and the health check are public. Protected routes without a Bearer header return **403**; an invalid or expired token returns **401**.

### Error shape

FastAPI returns errors as:

```json
{ "detail": "Human-readable message" }
```

For AI refinement clarifications, `detail` is an object:

```json
{ "detail": { "clarifyingPrompt": "Could you say more about..." } }
```

Validation failures (bad types, out-of-range numbers) return **422** with a `detail` array describing each field.

---

## CommuteScenario lifecycle

Every neighborhood search is a **CommuteScenario**. When you create one, it moves through these states:

```
DRAFT → SUBMITTED → ANALYZING → RANKED → EXPLAINED
                              ↘ FAILED
```

A user can also mark a finished scenario as **SAVED** for later. Not every transition is a separate API call — `POST /api/v1/scenarios` runs geocoding, zone discovery, and scoring in one request and usually lands you at **RANKED**.

| Status | Meaning |
|--------|---------|
| `DRAFT` | Created but geocoding failed; no recommendations yet |
| `SUBMITTED` | Brief internal state during creation |
| `ANALYZING` | Geocoded; commute/lifestyle scores being computed |
| `RANKED` | Recommendations ready; filters and explain can run |
| `EXPLAINED` | AI summaries attached; refine is allowed |
| `FAILED` | External routing API failed mid-pipeline |
| `SAVED` | User bookmarked this scenario for reuse |

---

## Shared response types

These show up across multiple endpoints. Field names are exactly what the JSON uses.

### `ScenarioResponse`

The main payload for anything scenario-related.

| Field | Type | Description |
|-------|------|-------------|
| `scenarioId` | string (UUID) | Unique scenario identifier |
| `searchRadiusMiles` | number | Radius used for zone discovery |
| `createdAt` | ISO 8601 datetime | When the scenario was created |
| `status` | enum | Lifecycle state (see above) |
| `workplace` | object | `{ address, latitude, longitude }` |
| `preferenceProfile` | object | Active commute/lifestyle preferences |
| `recommendations` | array | Ranked zones with scores and analyses |

### `PreferenceProfile`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxCommuteMinutes` | int | 45 | Hard cap on acceptable commute (5–120) |
| `avoidHighways` | bool | false | Prefer routes without highways |
| `maxTransfers` | int | 3 | Max transit transfers tolerated |
| `prefersTransit` | bool | false | Weight transit over driving |
| `prefersDriving` | bool | false | Weight driving over transit |
| `wantsQuietArea` | bool | false | Boost quiet neighborhoods (often set by AI) |

### `Recommendation`

| Field | Type | Description |
|-------|------|-------------|
| `rank` | int | Position in ranked list (1 = best) |
| `totalScore` | float | Combined commute + lifestyle score |
| `explanationSummary` | string | AI text; empty until explain/refine runs |
| `meetsFilters` | bool | `false` when zone fails active filters (dimmed on map, not deleted) |
| `zone` | object | `{ zoneId, name, boundaryGeoJson, centerLat, centerLng }` |
| `commuteAnalysis` | object | See `CommuteAnalysis` below |
| `lifestyleAnalysis` | object | Walkability, grocery, park, nightlife, quietness scores |

### `CommuteAnalysis`

| Field | Type | Description |
|-------|------|-------------|
| `driveTimePeakMinutes` | int | Peak-hour drive time (minutes) |
| `driveTimeNoHighwaysPeakMinutes` | int | Drive time avoiding highways (used when `avoidHighways` is on) |
| `transitTimePeakMinutes` | int | Peak-hour transit time (minutes) |
| `walkingMinutesToStop` | int | Walk time to nearest transit stop |
| `transferCount` | int | Number of transit transfers |
| `congestionLevel` | float | Traffic congestion on a 0–1 scale |

### `HousingListing`

| Field | Type | Description |
|-------|------|-------------|
| `listingId` | string | Provider-specific listing ID |
| `address` | string | Street address |
| `rent` | number | Monthly rent in USD |
| `bedrooms` | int | Bedroom count |
| `bathrooms` | int | Bathroom count |
| `url` | string | Link to external listing page |
| `listingAgentName` | string \| null | Optional agent contact |
| `listingAgentPhone` | string \| null | Optional |
| `listingAgentEmail` | string \| null | Optional |
| `listingOfficeName` | string \| null | Optional brokerage name |

---

## System

### 1. Health check

`GET /health`

**Semantics:** Lightweight liveness probe. Confirms the process is up; does not check database or external APIs.

**Params:** None.

**Pre-conditions:** None.

**Post-conditions:** Returns `{ "status": "ok" }`.

**Errors:** None expected.

---

### 2. Root

`GET /`

**Semantics:** Simple welcome message for sanity checks.

**Params:** None.

**Post-conditions:** Returns `{ "message": "RelocateIQ backend is running" }`.

---

## Authentication

Auth was added after the original design doc. It lets users save scenarios and keeps searches tied to an account.

### 3. Sign up

`POST /api/v1/auth/signup`

**Semantics:** Creates a new user account and immediately returns a JWT so the client can authenticate without a second login call.

**Params (JSON body):**

| Field | Type | Constraints |
|-------|------|-------------|
| `email` | string | Valid email format |
| `name` | string | 1–255 characters |
| `password` | string | 8–72 characters (bcrypt limit) |

**Pre-conditions:** Email must not already be registered.

**Post-conditions:** User row created in PostgreSQL; JWT issued.

**Response:** `201 Created`

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**

| Code | When |
|------|------|
| 400 | Email already registered |
| 422 | Invalid email, missing fields, or password too short |

---

### 4. Log in

`POST /api/v1/auth/login`

**Semantics:** Verifies email/password and issues a fresh access token.

**Params (JSON body):**

| Field | Type |
|-------|------|
| `email` | string |
| `password` | string |

**Pre-conditions:** Account exists with matching credentials.

**Post-conditions:** JWT returned; no server-side session stored.

**Response:** `200 OK` — same `TokenResponse` shape as signup.

**Errors:**

| Code | When |
|------|------|
| 401 | Wrong email or password (same message for both, so we don't leak which emails exist) |
| 422 | Malformed body |

---

### 5. Current user

`GET /api/v1/auth/me`

**Semantics:** Returns the authenticated user's profile. Used on app load to restore session state.

**Params:** None (identity comes from Bearer token).

**Pre-conditions:** Valid, non-expired JWT.

**Post-conditions:** User object returned; `password_hash` is never included.

**Response:** `200 OK`

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "Alex"
}
```

**Errors:**

| Code | When |
|------|------|
| 401 | Missing, invalid, or expired token |

---

## Scenarios (core recommendation flow)

These endpoints implement US-1 through US-3 from the design doc.

### 6. Generate recommendations

`POST /api/v1/scenarios`

**Semantics:** Creates a `CommuteScenario`, geocodes the workplace, discovers candidate neighborhoods within the search radius, and computes commute + lifestyle scores for each. This is the main entry point for the app — one call does the heavy lifting.

**Params (JSON body):**

| Field | Type | Constraints |
|-------|------|-------------|
| `workplaceAddress` | string | Full address or place name; must be geocodable |
| `maxRadiusMiles` | float | 0.5–50 miles |
| `departureTimeMinutes` | int (optional) | Minutes since midnight (0–1439), e.g. `450` = 7:30 AM. Defaults to weekday rush hour if omitted |

**Pre-conditions:** Caller is authenticated. Address is valid/geocodable; radius in range.

**Post-conditions:** Scenario created and persisted. On success, status is **RANKED** with up to ~20 scored recommendations. Workplace coordinates stored so later calls don't re-geocode.

**Response:** `201 Created` — full `ScenarioResponse`.

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workplaceAddress": "UCLA, Los Angeles, CA",
    "maxRadiusMiles": 15
  }'
```

**Errors:**

| Code | When |
|------|------|
| 400 | Address could not be geocoded, or `GOOGLE_MAPS_API_KEY` is missing/invalid |
| 401 | Not authenticated |
| 422 | Invalid radius, bad `departureTimeMinutes`, or no candidate zones in range |
| 503 | Google Distance Matrix / routing failure (scenario marked **FAILED**) |

**Notes:** Lifestyle scores come from precomputed `app/data/lifestyle.json` (Walk Score + Google Places at generation time). Commute metrics are live per request. Target render time: under 10 seconds for up to 20 zones.

---

### 7. List scenarios

`GET /api/v1/scenarios?saved_only=true`

**Semantics:** Returns scenarios belonging to the current user. The saved-scenarios page uses this to show bookmarked searches.

**Params (query):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `saved_only` | bool | `true` | When `true`, only **SAVED** scenarios; when `false`, all scenarios for the user |

**Pre-conditions:** Authenticated.

**Post-conditions:** Array of `ScenarioResponse` objects, newest first.

**Response:** `200 OK`

**Errors:** 401 if not authenticated.

---

### 8. Fetch scenario

`GET /api/v1/scenarios/{scenarioId}`

**Semantics:** Loads a single scenario by ID. Used when reopening a saved search from the dashboard URL (`?scenarioId=...`).

**Params:**

| Field | Location | Type |
|-------|----------|------|
| `scenarioId` | path | UUID string |

**Pre-conditions:** Scenario exists and belongs to the authenticated user.

**Post-conditions:** Full scenario snapshot returned, including recommendations and current preference profile.

**Response:** `200 OK` — `ScenarioResponse`.

**Errors:**

| Code | When |
|------|------|
| 401 | Not authenticated |
| 404 | Unknown ID or scenario owned by another user |

---

### 9. Update preferences

`PATCH /api/v1/scenarios/{scenarioId}/preferences`

**Semantics:** Updates the user's `PreferenceProfile` and re-ranks zones against the **cached** commute/lifestyle data. No new geocoding or routing calls — this is intentionally fast so filter tweaks feel instant (US-2).

**Params:**

| Field | Location | Type | Description |
|-------|----------|------|-------------|
| `scenarioId` | path | UUID | Target scenario |
| `prefersTransit` | body (optional) | bool | Transit-only mode |
| `avoidHighways` | body (optional) | bool | Exclude highways from drive-time scoring |
| `maxCommuteMinutes` | body (optional) | int | 5–120 minutes |

Only fields you send are updated (PATCH semantics). Omitted fields stay as they were.

**Pre-conditions:** Scenario exists; status is **RANKED**, **EXPLAINED**, or **SAVED**.

**Post-conditions:** `PreferenceProfile` merged and saved. Recommendations re-ranked; zones over the commute cap get `meetsFilters: false` instead of being removed.

**Response:** `200 OK` — updated `ScenarioResponse`.

**Example:**

```bash
curl -X PATCH http://localhost:8000/api/v1/scenarios/$SCENARIO_ID/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "prefersTransit": true, "maxCommuteMinutes": 30 }'
```

**Errors:**

| Code | When |
|------|------|
| 401 | Not authenticated |
| 404 | Scenario not found |
| 409 | Scenario still in DRAFT, ANALYZING, etc. |
| 422 | `maxCommuteMinutes` out of range |

**Notes:** Filter state persists in the database, so navigating away and back restores it exactly.

---

### 10. Generate AI explanations

`POST /api/v1/scenarios/{scenarioId}/explain`

**Semantics:** Calls OpenAI to write a short plain-English summary for each ranked zone. Transitions the scenario to **EXPLAINED**. The frontend typically calls this right after a successful create, before the user sees the dashboard.

**Params:**

| Field | Location | Type |
|-------|----------|------|
| `scenarioId` | path | UUID |

**Pre-conditions:** Scenario exists; status must be exactly **RANKED** (not EXPLAINED, SAVED, etc.).

**Post-conditions:** Each recommendation gets an `explanationSummary`; status becomes **EXPLAINED**.

**Response:** `200 OK` — `ScenarioResponse`.

**Errors:**

| Code | When |
|------|------|
| 401 | Invalid or expired token |
| 403 | Missing Bearer header |
| 404 | Scenario not found |
| 409 | Status is not RANKED (e.g. already EXPLAINED or SAVED) |
| 502 | OpenAI timeout or provider error |

---

### 11. AI preference refinement

`POST /api/v1/scenarios/{scenarioId}/refine`

**Semantics:** Interprets natural-language preferences (US-3), patches the `PreferenceProfile`, re-ranks zones, and returns a summary of what changed. Example input: *"I prefer quieter neighborhoods and don't care about drive time."*

**Params:**

| Field | Location | Type |
|-------|----------|------|
| `scenarioId` | path | UUID |
| `userMessage` | body | string (min 1 char) |

**Pre-conditions:** Scenario is **EXPLAINED** or **SAVED**; recommendations and profile already populated.

**Post-conditions:** Preference weights updated and persisted. Zones re-ranked. Plain-text explanation returned at the top level.

**Response:** `200 OK`

```json
{
  "scenario": { /* full ScenarioResponse */ },
  "explanationSummary": "I bumped quietness and relaxed your drive-time weight..."
}
```

**Errors:**

| Code | When |
|------|------|
| 401 | Not authenticated |
| 404 | Scenario not found |
| 409 | Scenario not yet explained |
| 422 | AI could not interpret the message — `detail.clarifyingPrompt` asks a follow-up question |
| 502 | OpenAI provider failure |

**Notes:** Target response time is under 9 seconds. AI-adjusted weights are respected by later manual filter changes (US-2 + US-3 play nicely together).

---

### 12. Save scenario

`POST /api/v1/scenarios/{scenarioId}/save`

**Semantics:** Bookmarks a scenario for the saved-scenarios page. Does not re-run scoring.

**Params:**

| Field | Location | Type |
|-------|----------|------|
| `scenarioId` | path | UUID |

**Pre-conditions:** Scenario exists and belongs to the user.

**Post-conditions:** Status set to **SAVED**.

**Response:** `200 OK` — `ScenarioResponse`.

**Errors:** 401, 404.

---

## Housing listings (US-4)

### 13. Fetch zone listings

`GET /api/v1/zones/{zoneId}/listings`

**Semantics:** Returns rental listings near a recommended zone. Listings are loaded on demand when the user opens a zone detail panel — not bundled with the initial recommendation response.

**Params:**

| Field | Location | Type | Description |
|-------|----------|------|-------------|
| `zoneId` | path | string | Zone identifier (e.g. `westwood`, `santa-monica`) |

**Pre-conditions:** Authenticated. Zone ID exists in our neighborhoods catalog.

**Post-conditions:** Array of `HousingListing` objects. Unknown zones return an empty array (not 404).

**Response:** `200 OK` — `HousingListing[]`.

**Example:**

```bash
curl http://localhost:8000/api/v1/zones/westwood/listings \
  -H "Authorization: Bearer $TOKEN"
```

**Errors:**

| Code | When |
|------|------|
| 401 | Not authenticated |

**Provider behavior:** Controlled by `LISTING_PROVIDER` in `.env`:

| Value | Behavior |
|-------|----------|
| `static` | Reads `app/data/listings.json` — no external calls, good for tests (recommended in `.env.example`) |
| `rentcast` (code default if unset) | Live data from RentCast API; falls back to static if the key is missing, quota is hit, or the network fails |

**Design doc note:** The original spec mentioned a `scenarioId` query param and per-listing commute times to the workplace. The current implementation returns listing metadata only; commute context stays at the zone level in the scenario's recommendations. Per-unit routing is a natural follow-up behind the same `ListingProvider` interface.

---

## Legacy / development helpers

These routes predate the full scenario pipeline. They are **not** used by the production frontend flow but remain useful for quick API smoke tests.

### 14. One-off commute estimate

`POST /commute`

**Semantics:** Direct wrapper around Google Distance Matrix for a single origin → destination pair.

**Params (JSON body):**

| Field | Type | Description |
|-------|------|-------------|
| `origin` | string | Address or `lat,lng` |
| `destination` | string | Address or `lat,lng` |
| `departure_time` | int (optional) | Unix epoch seconds for traffic-aware routing |

**Post-conditions:** Distance and duration fields returned.

**Errors:** 502 on Google Maps failure.

**Auth:** Not required.

---

### 15. Rank neighborhoods by commute

`POST /neighborhoods/by-commute`

**Semantics:** Early prototype endpoint — ranks a fixed LA neighborhood list by drive time to a workplace. Superseded by `POST /api/v1/scenarios` for the real app.

**Params (JSON body):**

| Field | Type | Default |
|-------|------|---------|
| `work_address` | string | required |
| `max_minutes` | int | 45 (max 240) |

**Post-conditions:** `{ "results": [ { neighborhood, commute }, ... ] }`.

**Auth:** Not required.

---

## External dependencies

| Service | Used for | Env variable |
|---------|----------|--------------|
| Google Maps Platform | Geocoding, Distance Matrix (commute) | `GOOGLE_MAPS_API_KEY` |
| Walk Score + Google Places | Offline lifestyle generation (`scripts/generate_lifestyle.py`) | `WALKSCORE_API_KEY` |
| OpenAI | Explain + refine (US-3) | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| RentCast | Live housing listings (optional) | `RENTCAST_API_KEY`, `LISTING_PROVIDER` |
| PostgreSQL | Users, scenarios, preferences | `DATABASE_URL` |
| JWT | Auth tokens | `JWT_SECRET` |

If a third-party call fails during scenario creation, we surface a clear error and mark the scenario **FAILED** rather than returning half-baked rankings.

---

## Quick reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Liveness check |
| GET | `/` | No | Welcome message |
| POST | `/api/v1/auth/signup` | No | Create account + token |
| POST | `/api/v1/auth/login` | No | Login + token |
| GET | `/api/v1/auth/me` | Yes | Current user profile |
| POST | `/api/v1/scenarios` | Yes | Create + rank scenario (US-1) |
| GET | `/api/v1/scenarios` | Yes | List user scenarios |
| GET | `/api/v1/scenarios/{id}` | Yes | Fetch one scenario |
| PATCH | `/api/v1/scenarios/{id}/preferences` | Yes | Update filters + re-rank (US-2) |
| POST | `/api/v1/scenarios/{id}/explain` | Yes | AI zone summaries |
| POST | `/api/v1/scenarios/{id}/refine` | Yes | AI preference refinement (US-3) |
| POST | `/api/v1/scenarios/{id}/save` | Yes | Bookmark scenario |
| GET | `/api/v1/zones/{zoneId}/listings` | Yes | Housing listings (US-4) |
| POST | `/commute` | No | Dev: single commute lookup |
| POST | `/neighborhoods/by-commute` | No | Dev: prototype ranking |

---

## Changes from the design doc

A few things evolved during implementation:

- **Authentication** — Signup, login, and `/me` were added so scenarios can be saved per user. All scenario/listing routes now require a Bearer token.
- **Explain endpoint** — Split out as `POST .../explain` instead of happening implicitly inside create. The frontend chains create → explain for a smoother loading UX.
- **Save endpoint** — `POST .../save` supports the saved-scenarios page (not in the original four-endpoint list).
- **Listings provider** — We use RentCast (with a static JSON fallback) instead of Zillow, behind a swappable `ListingProvider` interface as planned.
- **Max commute slider** — API accepts 5–120 minutes (design doc said 5–60); the frontend slider can be tightened without backend changes.
- **Per-listing commute** — Not yet on the listings response; zone-level commute lives on each `Recommendation`.
