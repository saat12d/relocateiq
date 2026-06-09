"""
Housing listing providers for the app.
Defines the ListingProvider ABC, StaticListingProvider (default, reads from
data/listings.json), and RentCastListingProvider (live data via RentCast API).
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path

import httpx

from app.schemas.scenario import HousingListing

_logger = logging.getLogger(__name__)

LISTING_PATH = Path(__file__).resolve().parent.parent / "data" / "listings.json"
RENTCAST_URL = "https://api.rentcast.io/v1/listings/rental/long-term"

# Module-level cache: keyed by zone_id. Resets on uvicorn restart.
_rentcast_cache: dict[str, list[HousingListing]] = {}
# Hard counter of real RentCast HTTP calls made this process lifetime.
_rentcast_request_count: int = 0


@lru_cache(maxsize=1)
def load_static_listings() -> dict:
    with LISTING_PATH.open() as handle:
        return json.load(handle)


class ListingProvider(ABC):
    @abstractmethod
    def get_listings(self, zone_id: str) -> list[HousingListing]:
        raise NotImplementedError


class StaticListingProvider(ListingProvider):
    def get_listings(self, zone_id: str) -> list[HousingListing]:
        raw_data = load_static_listings().get(zone_id, [])
        return [HousingListing(**item) for item in raw_data]


def _get_zone_center(zone_id: str) -> tuple[float, float] | None:
    """Return (lat, lng) for a zone, or None if not found."""
    from app.services.zones import load_neighborhoods
    for zone in load_neighborhoods():
        if zone.get("id") == zone_id:
            center = zone.get("center", {})
            lat = center.get("lat")
            lng = center.get("lng")
            if lat is not None and lng is not None:
                return float(lat), float(lng)
    return None


def _map_rentcast_listing(raw: dict) -> HousingListing:
    """Map a single RentCast listing dict to a HousingListing."""
    listing_id = str(raw.get("id") or "")
    address = str(raw.get("formattedAddress") or raw.get("addressLine1") or "")
    rent = float(raw.get("price") or 0.0)
    bedrooms = int(raw.get("bedrooms") or 1)
    # HousingListing.bathrooms is int; RentCast returns floats (e.g. 1.5) — round to nearest.
    bathrooms = int(round(float(raw.get("bathrooms") or 1.0)))
    url = (
        f"https://app.rentcast.io/app?propertyId={listing_id}"
        if listing_id
        else "https://app.rentcast.io/app"
    )
    # Contact info — both objects are optional in the RentCast response.
    agent = raw.get("listingAgent") or {}
    office = raw.get("listingOffice") or {}
    return HousingListing(
        listing_id=listing_id,
        address=address,
        rent=rent,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        url=url,
        listing_agent_name=agent.get("name") or None,
        listing_agent_phone=agent.get("phone") or None,
        listing_agent_email=agent.get("email") or None,
        listing_office_name=office.get("name") or None,
    )


class RentCastListingProvider(ListingProvider):
    def get_listings(self, zone_id: str) -> list[HousingListing]:
        global _rentcast_request_count

        # 1. In-process cache — zero extra billed calls for repeated zone opens.
        if zone_id in _rentcast_cache:
            return _rentcast_cache[zone_id]

        # 2. Validate API key before touching the network.
        key = os.getenv("RENTCAST_API_KEY", "")
        if not key or key.startswith("your_"):
            _logger.warning("RENTCAST_API_KEY not configured; falling back to static")
            return StaticListingProvider().get_listings(zone_id)

        # 3. Hard request guard — never exceed the monthly quota ceiling.
        max_requests = int(os.getenv("RENTCAST_MAX_REQUESTS", "40"))
        if _rentcast_request_count >= max_requests:
            _logger.warning(
                "RentCast request ceiling %d reached; falling back to static", max_requests
            )
            return StaticListingProvider().get_listings(zone_id)

        # 4. Resolve zone centre coordinates for the radius search.
        center = _get_zone_center(zone_id)
        if center is None:
            _logger.warning(
                "Zone %s not in neighborhoods data; falling back to static", zone_id
            )
            return StaticListingProvider().get_listings(zone_id)

        lat, lng = center

        # 5. One HTTP call, no pagination.
        _rentcast_request_count += 1
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(
                    RENTCAST_URL,
                    headers={"X-Api-Key": key},
                    params={
                        "latitude": lat,
                        "longitude": lng,
                        "radius": 2.0,
                        "status": "Active",
                        "limit": 20,
                    },
                )

            if response.status_code != 200:
                _logger.warning(
                    "RentCast HTTP %d for zone %s; falling back to static",
                    response.status_code,
                    zone_id,
                )
                return StaticListingProvider().get_listings(zone_id)

            listings = [_map_rentcast_listing(item) for item in response.json()]
            _rentcast_cache[zone_id] = listings
            return listings

        except Exception as exc:
            _logger.warning(
                "RentCast error for zone %s: %s; falling back to static", zone_id, exc
            )
            return StaticListingProvider().get_listings(zone_id)


def get_listing_provider() -> ListingProvider:
    """Return the active provider. Controlled by LISTING_PROVIDER env var.

    Values: 'static' (default) | 'rentcast'
    Static is the default so tests, teammates, and normal dev never touch RentCast.
    """
    provider_name = os.getenv("LISTING_PROVIDER", "rentcast").lower()
    if provider_name == "rentcast":
        return RentCastListingProvider()
    return StaticListingProvider()
