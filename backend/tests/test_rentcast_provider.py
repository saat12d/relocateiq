"""
Unit tests for RentCastListingProvider.

All tests mock httpx.Client — zero real network calls are made.
Covers: successful mapping (including 1.5-bath coercion), cache behaviour,
provider selection, and every fallback path (bad key, timeout, HTTP error,
quota ceiling).
"""

from unittest.mock import MagicMock, patch

import httpx as httpx_module
import pytest

import app.services.listings as listings_module
from app.services.listings import (
    RentCastListingProvider,
    StaticListingProvider,
    get_listing_provider,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_LISTINGS = [
    {
        "id": "rc-001",
        "formattedAddress": "123 Elm St, Westwood, CA 90024",
        "price": 2800.0,
        "bedrooms": 2,
        "bathrooms": 1.5,
        "listingAgent": {
            "name": "Jane Smith",
            "phone": "310-555-0100",
            "email": "jane@example.com",
            "website": "https://jane.example.com",
        },
        "listingOffice": {
            "name": "West LA Realty",
            "phone": "310-555-0200",
            "email": "office@example.com",
            "website": "https://westlarealty.example.com",
        },
    },
    {
        "id": "rc-002",
        "formattedAddress": "456 Oak Ave, Westwood, CA 90024",
        "price": 3200.0,
        "bedrooms": 3,
        "bathrooms": 2.0,
        # no contact info on this listing — both fields absent
    },
]


def _make_httpx_patch(json_body, status_code=200):
    """Return a patch() context manager for httpx.Client that returns a canned response."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_body

    mock_client = MagicMock()
    mock_client.get.return_value = mock_response

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_client)
    mock_cm.__exit__ = MagicMock(return_value=False)

    return patch("app.services.listings.httpx.Client", return_value=mock_cm)


@pytest.fixture(autouse=True)
def reset_rentcast_state():
    """Wipe the module-level cache and counter before (and after) each test."""
    listings_module._rentcast_cache.clear()
    listings_module._rentcast_request_count = 0
    yield
    listings_module._rentcast_cache.clear()
    listings_module._rentcast_request_count = 0


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------


def test_get_listing_provider_defaults_to_rentcast(monkeypatch):
    """LISTING_PROVIDER unset → RentCastListingProvider (current default)."""
    monkeypatch.delenv("LISTING_PROVIDER", raising=False)
    assert isinstance(get_listing_provider(), RentCastListingProvider)


def test_get_listing_provider_static_explicit(monkeypatch):
    """LISTING_PROVIDER=static → StaticListingProvider."""
    monkeypatch.setenv("LISTING_PROVIDER", "static")
    assert isinstance(get_listing_provider(), StaticListingProvider)


def test_get_listing_provider_rentcast(monkeypatch):
    """LISTING_PROVIDER=rentcast → RentCastListingProvider."""
    monkeypatch.setenv("LISTING_PROVIDER", "rentcast")
    assert isinstance(get_listing_provider(), RentCastListingProvider)


# ---------------------------------------------------------------------------
# Successful mapping
# ---------------------------------------------------------------------------


def test_maps_fields_correctly(monkeypatch):
    """Successful response: all HousingListing fields populated from RentCast data."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    with _make_httpx_patch(MOCK_LISTINGS):
        listings = RentCastListingProvider().get_listings("westwood")

    assert len(listings) == 2

    first = listings[0]
    assert first.listing_id == "rc-001"
    assert first.address == "123 Elm St, Westwood, CA 90024"
    assert first.rent == 2800.0
    assert first.bedrooms == 2
    assert "rentcast" in first.url
    # contact fields populated from listingAgent / listingOffice
    assert first.listing_agent_name == "Jane Smith"
    assert first.listing_agent_phone == "310-555-0100"
    assert first.listing_agent_email == "jane@example.com"
    assert first.listing_office_name == "West LA Realty"

    second = listings[1]
    assert second.listing_id == "rc-002"
    assert second.rent == 3200.0
    assert second.bedrooms == 3
    # second listing has no contact data — all fields None
    assert second.listing_agent_name is None
    assert second.listing_agent_phone is None
    assert second.listing_agent_email is None
    assert second.listing_office_name is None


def test_half_bath_coerced_to_int_without_crash(monkeypatch):
    """A 1.5-bath listing is coerced to int (rounds to 2) without raising."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    half_bath = [
        {
            "id": "rc-half",
            "formattedAddress": "1 Test St, LA, CA 90000",
            "price": 2000.0,
            "bedrooms": 1,
            "bathrooms": 1.5,
        }
    ]

    with _make_httpx_patch(half_bath):
        listings = RentCastListingProvider().get_listings("westwood")

    assert len(listings) == 1
    listing = listings[0]
    assert isinstance(listing.bathrooms, int)
    assert listing.bathrooms == 2  # round(1.5) == 2


def test_missing_fields_use_sane_defaults(monkeypatch):
    """Listings with missing optional fields don't crash — defaults are used."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    sparse = [{"id": "rc-sparse"}]  # only id, everything else absent

    with _make_httpx_patch(sparse):
        listings = RentCastListingProvider().get_listings("westwood")

    assert len(listings) == 1
    assert listings[0].bedrooms == 1
    assert listings[0].bathrooms == 1
    assert listings[0].rent == 0.0


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


def test_cache_prevents_second_http_call(monkeypatch):
    """Second get_listings() for the same zone hits the cache, not the network."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    with _make_httpx_patch(MOCK_LISTINGS) as mock_client_class:
        provider = RentCastListingProvider()
        provider.get_listings("westwood")
        provider.get_listings("westwood")  # should be served from cache
        assert mock_client_class.call_count == 1


def test_different_zones_each_get_one_call(monkeypatch):
    """Two distinct zones each trigger exactly one HTTP call."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    with _make_httpx_patch(MOCK_LISTINGS) as mock_client_class:
        provider = RentCastListingProvider()
        provider.get_listings("westwood")
        provider.get_listings("santa-monica")
        assert mock_client_class.call_count == 2


# ---------------------------------------------------------------------------
# Fallback paths — must never raise; must return usable data
# ---------------------------------------------------------------------------


def test_missing_api_key_falls_back_to_static(monkeypatch):
    """No RENTCAST_API_KEY → falls back to static, no HTTP call made."""
    monkeypatch.delenv("RENTCAST_API_KEY", raising=False)

    with _make_httpx_patch([]) as mock_client_class:
        listings = RentCastListingProvider().get_listings("westwood")
        assert mock_client_class.call_count == 0

    assert len(listings) > 0  # static has westwood data


def test_placeholder_key_falls_back_to_static(monkeypatch):
    """Key starting with 'your_' is treated as unconfigured → static fallback."""
    monkeypatch.setenv("RENTCAST_API_KEY", "your_rentcast_key_here")

    with _make_httpx_patch([]) as mock_client_class:
        listings = RentCastListingProvider().get_listings("westwood")
        assert mock_client_class.call_count == 0

    assert len(listings) > 0


def test_timeout_falls_back_to_static(monkeypatch):
    """Network timeout falls back to static; endpoint still returns 200-shaped data."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    mock_client = MagicMock()
    mock_client.get.side_effect = httpx_module.TimeoutException("timed out")
    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_client)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("app.services.listings.httpx.Client", return_value=mock_cm):
        listings = RentCastListingProvider().get_listings("westwood")

    assert isinstance(listings, list)
    assert len(listings) > 0  # static fallback


def test_http_error_falls_back_to_static(monkeypatch):
    """Non-200 response (e.g. 429 rate-limit) falls back to static."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    with _make_httpx_patch([], status_code=429):
        listings = RentCastListingProvider().get_listings("westwood")

    assert isinstance(listings, list)
    assert len(listings) > 0


def test_request_ceiling_blocks_http_call(monkeypatch):
    """When the request ceiling is reached, no HTTP call is made and static is returned."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    monkeypatch.setenv("RENTCAST_MAX_REQUESTS", "0")

    with _make_httpx_patch(MOCK_LISTINGS) as mock_client_class:
        listings = RentCastListingProvider().get_listings("westwood")
        assert mock_client_class.call_count == 0

    assert isinstance(listings, list)
    assert len(listings) > 0


def test_request_ceiling_increments_and_blocks(monkeypatch):
    """Counter increments on each real call and stops new calls once ceiling is hit."""
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    monkeypatch.setenv("RENTCAST_MAX_REQUESTS", "1")

    with _make_httpx_patch(MOCK_LISTINGS) as mock_client_class:
        provider = RentCastListingProvider()
        provider.get_listings("westwood")      # consumes the 1 allowed call
        provider.get_listings("santa-monica")  # ceiling hit — no HTTP call
        assert mock_client_class.call_count == 1


# ---------------------------------------------------------------------------
# Static provider — contact fields must be absent (None), not a crash
# ---------------------------------------------------------------------------


def test_static_provider_listings_have_no_contact_fields():
    """Static listings don't include contact data; all four fields default to None."""
    provider = StaticListingProvider()
    listings = provider.get_listings("westwood")
    assert len(listings) > 0
    for listing in listings:
        assert listing.listing_agent_name is None
        assert listing.listing_agent_phone is None
        assert listing.listing_agent_email is None
        assert listing.listing_office_name is None
