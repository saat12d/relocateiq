from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.neighborhoods import rank_by_commute

router = APIRouter(prefix="/neighborhoods", tags=["neighborhoods"])


class ByCommuteRequest(BaseModel):
    work_address: str = Field(..., min_length=1, description="Address or 'lat,lng' string")
    max_minutes: int = Field(45, gt=0, le=240)


class Center(BaseModel):
    lat: float
    lng: float


class Neighborhood(BaseModel):
    id: str
    name: str
    city: str
    state: str
    center: Center
    median_rent_2br: Optional[int] = None
    description: Optional[str] = None


class Commute(BaseModel):
    duration_seconds: int
    duration_text: str
    distance_text: str


class RankedNeighborhood(BaseModel):
    neighborhood: Neighborhood
    commute: Commute


class ByCommuteResponse(BaseModel):
    results: list[RankedNeighborhood]


@router.post("/by-commute", response_model=ByCommuteResponse)
async def by_commute(req: ByCommuteRequest) -> ByCommuteResponse:
    ranked = await rank_by_commute(req.work_address, req.max_minutes)
    return ByCommuteResponse(results=ranked)
