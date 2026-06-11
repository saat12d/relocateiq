# Test Scenarios and Test Cases — Authentication

This section documents the testing of the authentication subsystem. It
describes each test suite, its setup/teardown, the individual test scenarios
(with inputs and expected outcomes / test oracles), and the edge cases,
boundary conditions, and error-handling scenarios considered. A guideline for
TAs (organization, what each suite validates, and how to run everything)
follows at the end.

## Overview of the auth test suites

Authentication is tested at three layers of the backend plus one layer on the
frontend, moving from isolated units to full integration:

| Suite | File | Layer tested | Style |
|-------|------|--------------|-------|
| Security primitives | `backend/tests/auth/test_security.py` | Password hashing + JWT logic (pure functions) | Unit |
| Service logic | `backend/tests/auth/test_auth_service.py` | Register / authenticate / token-resolution against a DB | Unit (with in-memory DB) |
| API endpoints | `backend/tests/auth/test_auth_endpoints.py` | Full HTTP stack (validation → router → service → response) | Integration |
| Frontend auth client | `frontend/src/lib/auth.test.ts` | Browser-side login flow + token handling | Unit (mocked fetch) |

This layering follows the testability principle of building from isolated
units up to full integration: if a low-level test fails, the bug is localized
to that layer, which makes diagnosis fast.

---

## Setup and teardown procedures

### Backend auth fixtures — `tests/auth/conftest.py`
File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/auth/conftest.py`

- **Setup:** Each test receives a fresh in-memory SQLite database. A new
  engine is created, all tables are built from `Base.metadata.create_all`,
  and a session is provided via the `db_session` fixture. The `client`
  fixture overrides the app's `get_db` dependency to use this session and
  wraps the app in an `httpx.AsyncClient` (ASGI transport).
- **Teardown:** Session closed, all tables dropped, engine disposed. The
  dependency override is cleared so it cannot leak into other test files.
### Backend scenario/listings fixtures — `tests/conftest.py` 
File: `https://github.com/saat12d/relocateiq/blob/b41573750f778dcc409084154e8275638710cb5b/backend/tests/conftest.py`
 
- **Setup:** Provides an `authenticated_client` fixture: signs up a real
  user via the auth endpoint (using an in-memory SQLite override of
  `get_db`), attaches their JWT to the client headers, and pins scenario
  persistence to the in-memory store by setting `scenario_store._DB_READY = False`.
- **Teardown:** Dependency override cleared; in-memory scenario store reset.
### Service-level unit tests (Google Maps, recommendation engine, AI, RentCast)
 
No shared fixtures. External HTTP calls are intercepted by `respx` (async)
or `unittest.mock.patch` (sync). OpenAI is replaced with `monkeypatch`
stubs. No real API calls are ever made; these suites are fully hermetic.

---

## Suite 1 — Security primitives (`test_security.py`)

Validates the four security functions (`hash_password`, `verify_password`,
`create_access_token`, `decode_access_token`) and the `InvalidTokenError`
exception. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/auth/test_security.py`.

| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_hash_password_does_not_return_plaintext` | A hashed password is never the plaintext | password `"correct horse battery staple"` | Result ≠ input; result begins with bcrypt prefix `$2` |
| `test_verify_password_accepts_correct_password` | Correct password verifies | hash of `"s3cur3-p@ssw0rd"`, then same password | Returns `True` |
| `test_verify_password_rejects_wrong_password` | Wrong password fails | hash of `"the right password"`, attempt `"the wrong password"` | Returns `False` |
| `test_same_password_produces_different_hashes` | Hashing is salted | same password hashed twice | The two hashes differ, yet both verify `True` |
| `test_token_round_trips` | A token decodes back to its subject | random UUID as user id | Decoded id equals the original id |
| `test_token_is_an_opaque_string` | Token is a usable string | user id `"some-user-id"` | Returns a non-empty `str` |
| `test_decode_rejects_garbage` | Non-token input is rejected | `"this is not a token"` | Raises `InvalidTokenError` |
| `test_decode_rejects_tampered_signature` | Forged token rejected | token signed with a *different* secret | Raises `InvalidTokenError` |
| `test_decode_rejects_token_without_subject` | Token missing `sub` claim rejected | validly-signed token with payload `{"foo": "bar"}` | Raises `InvalidTokenError` |
| `test_decode_rejects_expired_token` | Expired token rejected | validly-signed token with `exp` one second in the past | Raises `InvalidTokenError` |

**Edge cases / security scenarios covered here:**
- **Salting (boundary of "secure vs. insecure hashing").** The
  same-password-different-hashes test confirms bcrypt salts each hash; without
  it, identical passwords would collide and be vulnerable to rainbow-table
  attacks.
- **Signature forgery.** The tampered-signature test proves the signature is
  actually verified — without this check an attacker could mint a token
  claiming any user id.
- **Expiry enforcement** and **malformed/garbage input** are both exercised as
  error-handling scenarios, each asserting the specific `InvalidTokenError`
  rather than a generic failure.

---

## Suite 2 — Service logic (`test_auth_service.py`)

Validates the business logic (`register_user`, `authenticate_user`,
`get_user_by_token`) directly against the in-memory database, without HTTP.
File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/auth/test_auth_service.py`.

| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_register_user_creates_user_and_returns_token` | Signup persists a user and returns a usable token | email `alice@example.com`, name `Alice`, password `password123` | User row exists; stored `password_hash` is not the plaintext and begins with `$2`; returned token decodes to the new user's id |
| `test_register_user_rejects_duplicate_email` | Duplicate email blocked | register `bob@example.com` twice | Second call raises `EmailAlreadyRegisteredError` |
| `test_authenticate_user_succeeds_with_correct_password` | Valid login returns correct token | registered user, correct password | Returned token decodes to that user's id |
| `test_authenticate_user_rejects_wrong_password` | Wrong password rejected | registered user, wrong password | Raises `InvalidCredentialsError` |
| `test_authenticate_user_rejects_unknown_email` | Unknown email rejected identically | email never registered | Raises `InvalidCredentialsError` (same error as wrong password) |
| `test_get_user_by_token_returns_correct_user` | Valid token resolves to its user | token from a fresh signup | Returns the matching `User` (correct email and name) |
| `test_get_user_by_token_rejects_bad_token` | Garbage token rejected | `"not-a-real-token"` | Raises `InvalidTokenError` |
| `test_get_user_by_token_rejects_vanished_user` | Token for a deleted user rejected | valid token, then the user is deleted | Raises `UserNotFoundError` |

**Edge cases / error-handling covered here:**
- **User enumeration defense.** A wrong password and an unknown email raise the
  *same* `InvalidCredentialsError`, so an attacker cannot determine which
  emails are registered by comparing error responses.
- **Stale token / vanished user.** A validly-signed token whose user has since
  been deleted is rejected with `UserNotFoundError`, covering the gap between
  "token is cryptographically valid" and "the user still exists."

---

## Suite 3 — API endpoints (`test_auth_endpoints.py`)

Integration tests exercising the full HTTP stack — request validation, the
router, the service, and response serialization — via `httpx.AsyncClient`.
File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/auth/test_auth_endpoints.py`.

| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_signup_returns_201_and_token` | Valid signup | `{email, name, password}` | `201`; body has `token_type == "bearer"` and a non-empty `access_token` |
| `test_signup_duplicate_email_returns_400` | Duplicate signup | same payload twice | First `201`, second `400` with a `detail` field |
| `test_signup_short_password_returns_422` | Boundary: 7-char password | password `"1234567"` (7 chars) | `422` (validation rejects below 8-char minimum) |
| `test_signup_minimum_length_password_succeeds` | Boundary: 8-char password | password `"12345678"` (8 chars) | `201` (exactly at the minimum succeeds) |
| `test_signup_invalid_email_returns_422` | Malformed email | email `"not-an-email"` | `422` (email-format validation) |
| `test_login_returns_200_and_token` | Valid login | registered credentials | `200`; body has `token_type == "bearer"` and an `access_token` |
| `test_login_wrong_password_returns_401` | Wrong password | registered email, wrong password | `401` |
| `test_login_unknown_email_returns_401` | Unknown email | unregistered email | `401` (same as wrong password) |
| `test_me_returns_current_user_with_valid_token` | Authenticated identity | valid `Authorization: Bearer <token>` | `200`; body has `userId` (camelCase), correct `email`/`name`; **no** `password_hash`/`passwordHash` field present |
| `test_me_without_token_is_rejected` | Missing credentials | no Authorization header | `401` or `403` (request is not authenticated) |
| `test_me_with_bad_token_returns_401` | Invalid token | `Authorization: Bearer not-a-valid-token` | `401` |

**Edge cases / boundary / error-handling covered here:**
- **Password length boundary.** The 7-char (fail) and 8-char (pass) pair pins
  the exact minimum-length boundary, catching off-by-one errors in validation.
- **Input validation errors** (malformed email, short password) return `422`
  before any business logic runs.
- **Security leak check.** `/me` is explicitly asserted to *not* include the
  password hash in its response, confirming sensitive data is never exposed to
  the client.
- **Contract conformance.** Responses are asserted on specific fields
  (`token_type`, `access_token`, camelCase `userId`) so they match the exact
  contract the frontend depends on.

---

## Suite 4 — Google Maps service (`test_google_maps.py`)
 
Unit tests for `get_drive_time`. HTTP intercepted by `respx`. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_google_maps.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_get_drive_time_returns_parsed_fields` | Successful drive-time lookup | mocked `200`, no traffic | `origin_address`, `destination_address`, `distance_meters==5150`, `duration_seconds==540`, `duration_in_traffic_seconds is None` |
| `test_get_drive_time_includes_traffic_when_departure_time_set` | Traffic included with departure time | `departure_time=1_700_000_000` | `duration_in_traffic_seconds==660`; request carries `departure_time` and `traffic_model=best_guess` |
| `test_get_drive_time_raises_when_key_missing` | Missing API key | `GOOGLE_MAPS_API_KEY` unset | Raises `GoogleMapsError` (match: "not set") |
| `test_get_drive_time_raises_on_non_200` | HTTP error | mocked `500` | Raises `GoogleMapsError` (match: "HTTP 500") |
| `test_get_drive_time_raises_on_api_status_error` | API-level error | `{"status":"REQUEST_DENIED"}` | Raises `GoogleMapsError` (match: "REQUEST_DENIED") |
| `test_get_drive_time_raises_on_element_status_error` | Route-level error | element `{"status":"ZERO_RESULTS"}` | Raises `GoogleMapsError` (match: "ZERO_RESULTS") |
 
**Edge cases:** three distinct error layers tested independently; outgoing
request params verified directly.
 
---
 
## Suite 5 — Recommendation engine (`test_recommendation_engine.py`)
 
Pure unit tests for `rerank_with_preferences`. Small `Recommendation`
objects built inline — no HTTP, no mocks. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_recommendation_engine.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_wants_quiet_area_reranks_high_quietness_zones_first` | Quiet preference flips rank order | two zones: fast commute/low quietness vs. slower/high quietness; `wantsQuietArea=True` | Quieter zone ranked first despite worse commute |
| `test_transfer_count_above_max_sets_meets_filters_false` | Transfer cap flags zone | zone with `transfer_count > max_transfers` | `meets_filters == False`; `rank == 0` |
| `test_filtered_zones_remain_in_list` | Filtered zones kept, not dropped | zone exceeding transfer cap | Zone still present in returned list |
 
**Edge cases:** preference-weight interaction; filter semantics (zones are
flagged and dimmed, not removed, so filters are reversible).
 
---
 
## Suite 6 — AI explanation service (`test_ai_explanation.py`)
 
Unit tests for `generate_zone_summaries`. OpenAI replaced via `monkeypatch`.
File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_ai_explanation.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_generate_zone_summaries_batches_all_recommendations` | 12 recommendations split into batches of 5 | 12 `Recommendation` objects, `batch_size=5` | `_generate_batch_summaries` called with sizes `[5, 5, 2]`; 12 summaries returned in order |
 
**Edge cases:** partial last batch handled correctly; summary order preserved
across batch boundaries.
 
---
 
## Suite 7 — Scenario API (`test_scenarios.py`)
 
Full HTTP integration tests for the scenario endpoints (US-1, US-2, US-3).
Google Maps and geocoding mocked via `respx`; OpenAI via `monkeypatch`.
File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_scenarios.py`
 
A shared `_create_ranked_scenario(client)` factory mocks all external calls
and POSTs to `/api/v1/scenarios` — tests reuse it to avoid duplicating mock
wiring.
 
### Create scenario (US-1)
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_create_scenario_returns_201_and_ranked_zones` | Happy path | `workplaceAddress="UCLA"`, `maxRadiusMiles=15` | `201`; `scenarioId`, `status`, `recommendations` with `commuteAnalysis` present |
| `test_create_scenario_rejects_invalid_radius` | Radius below minimum | `maxRadiusMiles=0.1` | `422` |
| `test_create_scenario_returns_400_for_bad_address` | Ungeocodable address | geocoder returns `ZERO_RESULTS` | `400`; detail contains "could not be geocoded" |
| `test_create_scenario_returns_503_when_matrix_fails` | External API failure | Distance Matrix returns `500` | `503` |
| `test_create_scenario_forwards_departure_time_to_distance_matrix` | Custom departure time forwarded | `departureTimeMinutes=450` (7:30 AM) | `201`; Distance Matrix receives correct epoch at 7:30 on a weekday |
| `test_create_scenario_defaults_departure_time_when_omitted` | Default departure time applied | no `departureTimeMinutes` | `201`; Distance Matrix called with 8:00 AM weekday epoch |
| `test_next_weekday_epoch_uses_requested_time_of_day` | Epoch helper unit test | `hour=7, minute=30` | Returned epoch is in the future, Mon–Fri, hour=7, minute=30 |
| `test_fetch_scenario_returns_404_for_other_user` | Ownership enforced on fetch | user A creates; user B fetches | `404` |
 
### Update preferences (US-2)
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_update_preferences_reranks_and_filters_zones` | Preferences applied and zones re-ranked | `prefersTransit=True`, `avoidHighways=True`, `maxCommuteMinutes=30` | `200`; profile updated; all `meetsFilters=True`; ranks monotonically increase from 1 |
| `test_update_preferences_dims_zones_exceeding_max_commute` | Cap smaller than mocked drive time dims all zones | `maxCommuteMinutes=5` (mock drive=18 min) | `200`; all `meetsFilters=False`; all `rank==0`; zone count unchanged |
| `test_update_preferences_returns_404_for_unknown_scenario` | Nonexistent scenario | `scenarioId="does-not-exist"` | `404` |
| `test_update_preferences_rejects_out_of_range_max_commute` | Out-of-range boundary | `maxCommuteMinutes=200` | `422` |
| `test_update_preferences_returns_409_when_scenario_not_ranked` | State machine guard | scenario in `ANALYZING` | `409` |
 
### Explain + refine (US-3)
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_explain_scenario_populates_explanations` | Explain transitions to EXPLAINED | ranked scenario; `generate_zone_summaries` monkeypatched | `200`; status `EXPLAINED`; all `explanationSummary` non-empty |
| `test_explain_scenario_returns_409_when_not_ranked` | State guard | scenario in `ANALYZING` | `409` |
| `test_refine_scenario_updates_profile_and_reranks` | Refine updates preferences and re-ranks | EXPLAINED scenario; `parse_refinement` returns `{wantsQuietArea:True, prefersTransit:True, maxCommuteMinutes:30}` | `200`; profile updated; status `EXPLAINED`; `explanationSummary` non-empty |
| `test_refine_scenario_returns_422_when_clarification_required` | Ambiguous user message | `parse_refinement` raises `AIClarificationRequired` | `422`; detail has `clarifyingPrompt` |
| `test_refine_scenario_returns_409_when_not_explained` | State guard | scenario in `RANKED` | `409` |
| `test_refine_scenario_returns_502_on_ai_failure` | OpenAI failure | `parse_refinement` raises `AIExplanationError` | `502` |
 
### Save scenario
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_save_scenario_returns_404_for_other_user` | Save ownership enforced | user A creates; user B saves | `404` |
 
**Edge cases:** `maxCommuteMinutes=5` chosen because mock drive time is 18 min
(guaranteed eviction); `maxCommuteMinutes=200` tests the upper boundary; all
state machine transitions guarded with 409.
 
---
 
## Suite 8 — Listings endpoint (`test_listings.py`)
 
Integration tests for `GET /api/v1/zones/{zoneId}/listings` (US-4). Reads
a static JSON file — no external API. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_listings.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_listings_requires_auth` | Unauthenticated request blocked | no Authorization header | `401` or `403` |
| `test_listings_for_known_zone_returns_200_and_results` | Known zone returns listings | `zoneId="westwood"` | `200`; non-empty list |
| `test_listings_response_uses_camel_case_contract` | camelCase field names enforced | `zoneId="westwood"` | `listingId`, `address`, `rent`, `bedrooms`, `bathrooms`, `url` present; `listing_id` absent |
| `test_listings_for_unknown_zone_returns_empty_list` | Unknown zone returns empty | `zoneId="not-a-real-zone"` | `200`; `[]` |
| `test_listing_provider_cannot_be_instantiated` | Abstract base class guarded | `ListingProvider()` directly | Raises `TypeError` |
| `test_get_listing_provider_returns_rentcast_provider` | Factory default | default env | Returns `RentCastListingProvider` |
| `test_static_provider_returns_typed_listings` | Static provider returns typed objects | `zone_id="westwood"` | Non-empty list of `HousingListing` instances |
| `test_static_provider_unknown_zone_returns_empty_list` | Unknown zone | `zone_id="not-a-real-zone"` | `[]` |
| `test_static_provider_returns_three_listings_per_known_zone` | All 20 known zones have 3 listings | all zone ids | `len(listings) == 3` for every zone |
 
**Edge cases:** camelCase contract verified; unknown zone returns `200 []`
not 404; abstract class cannot be instantiated directly.
 
---
 
## Suite 9 — Lifestyle provider (`test_lifestyle_provider.py`)
 
Unit tests for Walk Score integration and lifestyle scoring math.
External HTTP mocked via `respx`. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_lifestyle_provider.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_fetch_walk_score_returns_parsed_score` | Successful Walk Score lookup | mocked `200` with `{status:1, walkscore:87}` | Returns `87` |
| `test_fetch_walk_score_raises_on_missing_key` | Missing API key | `WALKSCORE_API_KEY` unset | Raises `LifestyleError` |
| `test_fetch_walk_score_raises_on_http_error` | HTTP error | mocked `500` | Raises `LifestyleError` |
| `test_static_provider_returns_json_scores` | Static scores match JSON | `zone_id="westwood"` | `walkability_score` and `grocery_score` match `lifestyle.json` |
| `test_static_provider_defaults_unknown_zone` | Default scores for unknown zone | `zone_id="nowhere"` | `walkability_score==50`, `quietness_score==50` |
| `test_factory_returns_static_provider` | Factory returns correct type | default env | Returns `StaticLifestyleProvider` |
| `test_static_provider_get_scores` | Async provider matches sync scores | `zone_id="westwood"` | Scores match `static_scores("westwood")` |
| `test_score_places_buckets_types` | Places scored by type | one supermarket + one park | `grocery >= 5`, `park >= 5` |
| `test_percentile_scores_spreads_values` | Percentile ranking spreads values | `{a:1.0, b:5.0, c:10.0}` | `a < b < c`; all values in `[15, 95]` |
| `test_normalize_batch_preserves_nightlife_and_quietness` | Normalize preserves hand-researched scores | two zones with raw data | `nightlife_score` and `quietness_score` match existing `lifestyle.json` values |
 
**Edge cases:** three Walk Score error paths tested independently; default
score of 50 prevents crashes for unknown zones; percentile range `[15, 95]`
verified.
 
---
 
## Suite 10 — RentCast provider (`test_rentcast_provider.py`)
 
Unit tests for `RentCastListingProvider`. All HTTP mocked via
`unittest.mock.patch`. Module-level cache and request counter reset
before/after each test via an `autouse` fixture. File: `https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/test_rentcast_provider.py`
 
| Test method | Scenario | Input | Expected outcome (oracle) |
|-------------|----------|-------|---------------------------|
| `test_get_listing_provider_defaults_to_rentcast` | Factory default | `LISTING_PROVIDER` unset | Returns `RentCastListingProvider` |
| `test_get_listing_provider_static_explicit` | Static selected | `LISTING_PROVIDER=static` | Returns `StaticListingProvider` |
| `test_get_listing_provider_rentcast` | RentCast selected | `LISTING_PROVIDER=rentcast` | Returns `RentCastListingProvider` |
| `test_maps_fields_correctly` | All fields mapped correctly | 2-listing mock response | First listing: `listing_id=="rc-001"`, `rent==2800.0`, `bedrooms==2`, contact fields populated; second listing: all contact fields `None` |
| `test_half_bath_coerced_to_int_without_crash` | Float bath count handled | `bathrooms=1.5` | Returns without error; coerced to `int` |
| `test_quota_ceiling_prevents_http_call` | Request ceiling at zero | `RENTCAST_MAX_REQUESTS=0` | `httpx.Client` never called; static fallback returned |
| `test_request_ceiling_increments_and_blocks` | Counter blocks at ceiling | `RENTCAST_MAX_REQUESTS=1`; two calls | First call hits API; second returns static fallback without HTTP |
| `test_static_provider_listings_have_no_contact_fields` | Static listings have no contact data | `zone_id="westwood"` | All four contact fields are `None` |
 
**Edge cases:** `1.5`-bath float coercion; quota ceiling at both 0 and 1;
all three provider-selection states tested; contact-field absence tested
separately for static vs. RentCast listings.
 
---
 
## Suite 11 — Frontend auth client (`auth.test.ts`)

Validates the browser-side auth helper, which calls the backend and manages
the token. `fetch` is mocked so no real network call is made. File:
`https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/frontend/src/lib/auth.test.ts`.

| Test scenario | Input | Expected outcome (oracle) |
|---------------|-------|---------------------------|
| Login returns the auth response on success | mocked `200` with `{access_token, token_type}` | Resolves to the parsed auth response; `fetch` called with the login URL, `POST`, and the JSON body |
| Login surfaces the backend error message on `401` | mocked `401` with `{detail: "Incorrect email or password"}` | Rejects with that exact message |
| Login falls back to a default message on a malformed response | mocked `500` returning HTML, not JSON | Rejects with the default `"Unable to log in."` |
| Authenticated request injects the Bearer token | a saved token | Outgoing request carries `Authorization: Bearer <token>` and `Content-Type: application/json` |
| Authenticated request with no token | no saved token | Rejects with a "missing token" error; `fetch` is never called |

**Edge cases / error-handling covered here:** server errors that return
non-JSON bodies (graceful fallback), and the guard that prevents a request
from being sent at all when no token is present.

---

## Guideline for TAs

**1. How the tests are organized.**
All backend tests live in `backend/tests/`:
- `auth/` — auth unit and integration tests + `conftest.py`
- `test_google_maps.py` — Distance Matrix service unit tests
- `test_recommendation_engine.py` — scoring/re-ranking unit tests
- `test_ai_explanation.py` — AI batching unit tests
- `test_scenarios.py` — scenario API integration tests (US-1/2/3)
- `test_listings.py` — listings endpoint integration tests (US-4)
- `test_lifestyle_provider.py` — lifestyle scoring unit tests
- `test_rentcast_provider.py` — RentCast provider unit tests
- `conftest.py` — shared `authenticated_client` fixture (used by
  scenarios + listings suites)

Frontend tests: `frontend/src/lib/auth.test.ts`.

**2. What they validate.**
Security and auth (Suites 1–3, 11) cover cryptographic primitives, the full
register/login/token lifecycle, and the browser-side token management. The
core recommendation pipeline (Suites 4–7) covers the Distance Matrix client,
scoring and re-ranking, AI explanation/refinement, and the end-to-end
scenario API. Housing listings (Suites 8–10) cover the static and live
providers, the ListingProvider abstraction, and the listings endpoint
contract.

**3. How to install and run them.**
Backend (from `backend/`, with the virtual environment active and
dependencies installed per the project README):
```bash
pytest -v                 # full backend suite
pytest tests/auth/ -v     # auth tests only

# Run specific suites:
pytest tests/test_scenarios.py -v
```
Test configuration (test paths, async mode, Python path) is in
`backend/pytest.ini`; no additional setup is required, and the auth tests use
an in-memory database so a running Postgres instance is not needed for them.

Frontend (from `frontend/`):
```bash
npm test                  # runs the frontend test suite
```

---

## Software engineering practices

- **Version control & pull requests.** Work was done on feature branches and
  merged into `main` via pull requests; each PR required review and approval
  from at least one other team member before merging.
- **Code review.** PRs were reviewed for correctness, consistency with
  existing conventions, and test coverage before approval.
- **GenAI usage disclosure.** Per course policy, code developed with
  generative-AI assistance is annotated in-line with the prompt used, the
  generated response, and a reflection describing what was verified and
  changed.