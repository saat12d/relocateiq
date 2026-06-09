# [GenAI Use] Prompt: "Write pytest tests for my FastAPI endpoint
# GET /api/v1/zones/{zoneId}/listings. It returns a list of housing
# listings for a zone from a local JSON file (no API or database). Each
# listing has these fields: listingId, address, rent, bedrooms, bathrooms,
# url. An unknown zone should return an empty list with status 200. Test a
# zone that has listings, a zone that doesn't, the field names in the
# response, and that the provider classes work. Match the style of my
# existing test_scenarios.py file."
# [GenAI Use] LLM Response Start
"""
Integration tests for the housing listings endpoint.

These exercise the full HTTP stack for GET /api/v1/zones/{zoneId}/listings by
making request against the app via httpx.AsyncClient (same pattern as
test_scenarios.py). The endpoint reads from a static JSON file via
StaticListingProvider, so these tests touch no external API and no database --
they are fully hermetic.

Also includes unit-level checks on the ListingProvider abstraction itself.
"""

import httpx
import pytest

from app.main import app
from app.services.listings import (
    ListingProvider,
    RentCastListingProvider,
    StaticListingProvider,
    get_listing_provider,
)


# --- GET /api/v1/zones/{zoneId}/listings ---


async def test_listings_requires_auth():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/v1/zones/westwood/listings")

    assert response.status_code in (401, 403)


async def test_listings_for_known_zone_returns_200_and_results(authenticated_client):
    """A zone with listings returns 200 and a non-empty array."""
    client, _user_id = authenticated_client
    response = await client.get("/api/v1/zones/westwood/listings")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) > 0


async def test_listings_response_uses_camel_case_contract(authenticated_client):
    """
    Each listing exposes the camelCase fields the frontend HousingListing type
    expects, and never the snake_case internal names.
    """
    client, _user_id = authenticated_client
    response = await client.get("/api/v1/zones/westwood/listings")

    assert response.status_code == 200
    listing = response.json()[0]
    # camelCase keys present
    assert "listingId" in listing
    assert "address" in listing
    assert "rent" in listing
    assert "bedrooms" in listing
    assert "bathrooms" in listing
    assert "url" in listing
    # snake_case internal name must not leak
    assert "listing_id" not in listing


async def test_listings_for_unknown_zone_returns_empty_list(authenticated_client):
    """An unknown zone returns 200 with an empty array, not a 404."""
    client, _user_id = authenticated_client
    response = await client.get("/api/v1/zones/not-a-real-zone/listings")

    assert response.status_code == 200
    assert response.json() == []


# --- ListingProvider abstraction ---


def test_listing_provider_cannot_be_instantiated():
    """The abstract base class cannot be instantiated directly."""
    with pytest.raises(TypeError):
        ListingProvider()


def test_get_listing_provider_returns_rentcast_provider():
    """The factory returns RentCastListingProvider by default."""
    provider = get_listing_provider()
    assert isinstance(provider, RentCastListingProvider)


def test_static_provider_returns_typed_listings():
    """The static provider returns HousingListing objects, not raw dicts."""
    from app.schemas.scenario import HousingListing

    provider = StaticListingProvider()
    listings = provider.get_listings("westwood")
    assert len(listings) > 0
    assert all(isinstance(item, HousingListing) for item in listings)


def test_static_provider_unknown_zone_returns_empty_list():
    """The static provider returns an empty list for a zone with no entry."""
    provider = StaticListingProvider()
    assert provider.get_listings("not-a-real-zone") == []


def test_static_provider_returns_three_listings_per_known_zone():
    """Each neighborhood in the static data has three demo listings."""
    provider = StaticListingProvider()
    for zone_id in (
        "westwood",
        "santa-monica",
        "venice",
        "culver-city",
        "mar-vista",
        "playa-vista",
        "west-la",
        "brentwood",
        "beverly-hills",
        "west-hollywood",
        "hollywood",
        "los-feliz",
        "silver-lake",
        "echo-park",
        "downtown-la",
        "koreatown",
        "mid-city",
        "miracle-mile",
        "pasadena",
        "long-beach-downtown",
    ):
        listings = provider.get_listings(zone_id)
        assert len(listings) == 3, f"expected 3 listings for {zone_id}, got {len(listings)}"
# [GenAI Use] LLM Response End

# [GenAI Use] Reflection: These tests were easier to write than the scenario
# tests because the listings endpoint just reads a JSON file and doesn't call
# any outside API, so I didn't need to mock anything. I checked the main cases:
# a zone with listings returns them, an unknown zone returns an empty list
# instead of an error, and the response uses the camelCase field names the
# frontend expects. I also tested that the abstract provider class can't be
# created on its own and that the static provider returns the right objects.
# I thoroughly checked to make sure the tests were testing the right things, 
# everything checkout out so I commited these.