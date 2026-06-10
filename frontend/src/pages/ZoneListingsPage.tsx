import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import type { HousingListing } from "../models/types";
import { fetchZoneListings } from "../services/scenario";
import { withRequirements, userSignedInRequirement } from "../lib/Requirements";
import "./ListingDetailPage.css";
import "./ZoneListingsPage.css";

function ZoneListingsPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const location = useLocation();
  const scenarioId = (location.state as { scenarioId?: string } | null)
    ?.scenarioId;
  const backTo = scenarioId ? `/compare?scenarioId=${scenarioId}` : "/dashboard";
  // Fixed this to go back to the comparison, since it now has the scenarioID
  const backLabel = scenarioId ? "← Back to comparison" : "← Back to dashboard";
  const [listings, setListings] = useState<HousingListing[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!zoneId) {
      setStatus("error");
      return;
    }

    let cancelled = false;

    async function loadListings() {
      setStatus("loading");
      try {
        const data = await fetchZoneListings(zoneId!);
        if (cancelled) return;
        setListings(data);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    loadListings();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return (
    <main className="zone-listings-page">
      <div className="zone-listings-shell">
        <Link className="listing-detail-back" to={backTo}>
          {backLabel}
        </Link>

        {status === "loading" && (
          <section className="listing-detail-state">
            <h2>Loading listings</h2>
            <p>Fetching listings for this zone.</p>
          </section>
        )}

        {status === "error" && (
          <section className="listing-detail-state">
            <h2>Unable to load listings</h2>
            <p>Please try refreshing the page.</p>
          </section>
        )}

        {status === "ready" && (
          <>
            <header className="zone-listings-header">
              <h1 className="zone-listings-title">
                {listings.length} listing{listings.length !== 1 ? "s" : ""} in
                this zone
              </h1>
            </header>

            {listings.length === 0 ? (
              <section className="listing-detail-state">
                <h2>No listings available</h2>
                <p>No listings available for this neighborhood yet.</p>
              </section>
            ) : (
              <div className="zone-listings-grid">
                {listings.map((listing, index) => (
                  <article
                    className="zone-listing-card"
                    key={listing.listingId}
                  >
                    <div
                      className={`zone-listing-photo zone-listing-photo--${(index % 3) + 1}`}
                    />
                    <div className="zone-listing-body">
                      <div className="zone-listing-header">
                        <p className="zone-listing-address">{listing.address}</p>
                        <div className="zone-listing-price">
                          <strong>${listing.rent.toLocaleString()}</strong>
                          <small>/mo</small>
                        </div>
                      </div>
                      <p className="zone-listing-facts">
                        {listing.bedrooms} bed • {listing.bathrooms} bath
                      </p>
                      <Link
                        to={`/zones/${zoneId}/listings/${listing.listingId}`}
                        className="zone-listing-link"
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default withRequirements(ZoneListingsPage, [userSignedInRequirement]);
