"""
This is the hosuing listing providers for the app
This is where we define the ListingProvider Interface and a static listingProvider 
service that ses hardcoded listing from data/listings.jason.  
Todo: Integrate RentCastListingProvider
"""

import json
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path

from app.schemas.scenario import HousingListing
#now for the listing path, where we get the listings from
LISTING_PATH=Path(__file__).resolve().parent.parent / "data" /"listings.json"
#first method is to load the static listings
@lru_cache(maxsize=1)
def load_static_listings() -> dict:
    #loading and caching the hardcoded listings file
    with LISTING_PATH.open() as handle:
        return json.load(handle)
    
class ListingProvider(ABC):
    #this is the interface for fetching thehousing listings for a zone
    @abstractmethod
    def get_listings(self,zone_id:str)->list[HousingListing]:
        #this returns the housing listing for that zone
        #this is the non static one which is a to do
        raise NotImplementedError
    
#now for the static one
class StaticListingProvider(ListingProvider):
    #serves the same purpose but using the hardcoded listing.json
    #no API keys needed for this one
    def get_listings(self, zone_id:str)->list[HousingListing]:
        raw_data=load_static_listings().get(zone_id,[])
        return [HousingListing(**item) for item in raw_data]
    
def get_listing_provider() -> ListingProvider:
    #this is simply to retun the listing provider, subject to change in the future
    return StaticListingProvider()
