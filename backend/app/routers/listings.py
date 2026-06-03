from fastapi import APIRouter, Depends

from app.auth.deps import get_current_user
from app.db.models import User
from app.schemas.scenario import HousingListing
from app.services.listings import get_listing_provider

router = APIRouter(prefix="/api/v1/zones", tags=["listings"])


@router.get("/{zone_id}/listings", response_model=list[HousingListing])
async def get_zone_listing(
    zone_id: str,
    _user: User = Depends(get_current_user),
) -> list[HousingListing]:
    provider = get_listing_provider()
    return provider.get_listings(zone_id)
