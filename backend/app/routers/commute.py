from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.google_maps import GoogleMapsError, get_drive_time

router = APIRouter(prefix="/commute", tags=["commute"])


class CommuteRequest(BaseModel):
    origin: str = Field(..., description="Address or 'lat,lng' string")
    destination: str = Field(..., description="Address or 'lat,lng' string")
    departure_time: Optional[int] = Field(
        None,
        description="Unix epoch seconds for a future departure. Enables traffic-aware estimates.",
    )


class CommuteResponse(BaseModel):
    origin_address: str
    destination_address: str
    distance_meters: int
    distance_text: str
    duration_seconds: int
    duration_text: str
    duration_in_traffic_seconds: Optional[int] = None
    duration_in_traffic_text: Optional[str] = None


@router.post("", response_model=CommuteResponse)
async def compute_commute(req: CommuteRequest) -> CommuteResponse:
    try:
        data = await get_drive_time(
            origin=req.origin,
            destination=req.destination,
            departure_time=req.departure_time,
        )
    except GoogleMapsError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return CommuteResponse(**data)
