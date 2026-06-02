from fastapi import APIRouter
from app.schemas.scenario import HousingListing
from app.services.listings import get_listing_provider
#setting up the router
router=APIRouter(prefix="/api/v1/zones",tags=["listings"])


@router.get("/{zone_id}/listings", response_model=list[HousingListing])
async def get_zone_listing(zone_id:str)->list[HousingListing]:
    provider=get_listing_provider()
    return provider.get_listings(zone_id)