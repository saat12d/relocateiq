import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { HousingListing } from "../models/types";
import { fetchZoneListings } from "../services/scenario";
import { withRequirements, userSignedInRequirement } from "../lib/Requirements";
import "./ListingDetailPage.css";

function ListingDetailPage() {
  const { zoneId, listingId } = useParams<{
    zoneId: string;
    listingId: string;
  }>();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "not-found"
  >("loading");

  useEffect(() => {
    if (!zoneId || !listingId) {
      setStatus("not-found");
      return;
    }

    let cancelled = false;

    async function loadListing() {
      setStatus("loading");
      try {
        const listings = await fetchZoneListings(zoneId!);
        if (cancelled) return;
        const found = listings.find((l) => l.listingId === listingId);
        if (found) {
          setListing(found);
          setStatus("ready");
        } else {
          setStatus("not-found");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    loadListing();
    return () => {
      cancelled = true;
    };
  }, [zoneId, listingId]);

  return (
    <main className="listing-detail-page">
      <div className="listing-detail-shell">
        <Link className="listing-detail-back" to="/dashboard">
          ← Back to dashboard
        </Link>

        {status === "loading" && (
          <section className="listing-detail-state">
            <h2>Loading listing</h2>
            <p>Fetching listing details.</p>
          </section>
        )}

        {status === "error" && (
          <section className="listing-detail-state">
            <h2>Unable to load listing</h2>
            <p>Please try refreshing the page.</p>
          </section>
        )}

        {status === "not-found" && (
          <section className="listing-detail-state">
            <h2>Listing not found</h2>
            <p>This listing may have been removed or the link is invalid.</p>
          </section>
        )}

        {status === "ready" && listing && (
          <article className="listing-detail-card">
            <div className="listing-detail-photo" />
            <div className="listing-detail-body">
              <header className="listing-detail-header">
                <div>
                  <p className="listing-detail-address">{listing.address}</p>
                </div>
                <div className="listing-detail-price">
                  <strong>${listing.rent.toLocaleString()}</strong>
                  <small>/mo</small>
                </div>
              </header>

              <dl className="listing-detail-facts">
                <div>
                  <dt>Bedrooms</dt>
                  <dd>{listing.bedrooms}</dd>
                </div>
                <div>
                  <dt>Bathrooms</dt>
                  <dd>{listing.bathrooms}</dd>
                </div>
                <div>
                  <dt>Monthly rent</dt>
                  <dd>${listing.rent.toLocaleString()}</dd>
                </div>
              </dl>

              {(listing.listingAgentName ||
                listing.listingAgentPhone ||
                listing.listingAgentEmail ||
                listing.listingOfficeName) && (
                <section className="listing-detail-contact">
                  <p className="listing-detail-contact__label">Contact</p>
                  {listing.listingAgentName && (
                    <p className="listing-detail-contact__name">
                      Listed by {listing.listingAgentName}
                    </p>
                  )}
                  {listing.listingOfficeName && (
                    <p className="listing-detail-contact__office">
                      {listing.listingOfficeName}
                    </p>
                  )}
                  {listing.listingAgentPhone && (
                    <a
                      href={`tel:${listing.listingAgentPhone}`}
                      className="listing-detail-contact__link"
                    >
                      {listing.listingAgentPhone}
                    </a>
                  )}
                  {listing.listingAgentEmail && (
                    <a
                      href={`mailto:${listing.listingAgentEmail}`}
                      className="listing-detail-contact__link"
                    >
                      {listing.listingAgentEmail}
                    </a>
                  )}
                </section>
              )}

              <div className="listing-detail-actions">
                <a
                  href={listing.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="listing-detail-cta"
                >
                  View on listing site
                </a>
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}

export default withRequirements(ListingDetailPage, [userSignedInRequirement]);
