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

**Backend security tests** (`test_security.py`) require no setup — the
functions under test are pure (no database, no network). A `JWT_SECRET`
environment variable is provided by the test fixtures so the security module
can sign and verify tokens.

**Backend service and endpoint tests** share fixtures defined in
`backend/tests/auth/conftest.py` (`https://github.com/saat12d/relocateiq/blob/05630ab3513617bafd3528a69cc2a52c085e5797/backend/tests/auth/conftest.py`):

- **Setup:** Each test gets a *fresh in-memory SQLite database*. A new engine
  is created, all tables are built from the SQLAlchemy models
  (`Base.metadata.create_all`), and a session is provided via the `db_session`
  fixture. For endpoint tests, the `client` fixture additionally overrides the
  app's `get_db` dependency so the API uses this in-memory database instead of
  Postgres, and wraps the app in an `httpx.AsyncClient` (ASGI transport) so
  tests can issue real HTTP-style requests without a running server.
- **Teardown:** After each test the session is closed, all tables are dropped,
  and the engine is disposed. The dependency override is cleared so it never
  leaks into other tests.

This design is a deliberate testability choice. Using an isolated in-memory
database gives full **controllability** (each test defines its own starting
state) and guarantees the tests never touch the real Postgres development
data. Overriding `get_db` is an application of the **test double** pattern: the
real database dependency is replaced with a controlled substitute. The
frontend tests apply the same idea by mocking the global `fetch` function.

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

## Suite 4 — Frontend auth client (`auth.test.ts`)

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
Backend auth tests live in `backend/tests/auth/`:
- `test_security.py` — pure-function unit tests for hashing and JWTs.
- `test_auth_service.py` — service-logic unit tests against an in-memory DB.
- `test_auth_endpoints.py` — full HTTP integration tests.
- `conftest.py` — shared fixtures (the in-memory SQLite database and the
  HTTP client with the `get_db` override).
Frontend auth tests live at `frontend/src/lib/auth.test.ts`.

**2. What they validate.**
Password hashing and token security (Suite 1), the register/login/identity
business logic including duplicate-email and user-enumeration handling
(Suite 2), the public API contract and HTTP error codes the frontend relies on
(Suite 3), and the browser-side login flow and token handling (Suite 4).

**3. How to install and run them.**
Backend (from `backend/`, with the virtual environment active and
dependencies installed per the project README):
```bash
pytest -v                 # full backend suite
pytest tests/auth/ -v     # auth tests only
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