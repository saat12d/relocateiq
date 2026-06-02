import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mapPreview from "../assets/home-map.png";
import "../components/Dashboard/Dashboard.css";

type Tone = "green" | "amber" | "red";

type Neighborhood = {
  id: string;
  rank: number;
  name: string;
  tone: Tone;
  drive: number;
  transit: number;
  transfers: number;
  walkability: number;
  vibe: string;
  safety: number;
  amenities: number;
  schools: number;
  summary: string;
  coordinates: [number, number];
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const HAS_MAPBOX_TOKEN = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== "your_mapbox_public_token_here");
const WORKPLACE: [number, number] = [-118.255, 34.049];

const colors: Record<Tone, string> = {
  green: "#4f9d52",
  amber: "#f3a428",
  red: "#d84f3f",
};

const neighborhoods: Neighborhood[] = [
  {
    id: "highland-park",
    rank: 1,
    name: "Highland Park",
    tone: "green",
    drive: 18,
    transit: 24,
    transfers: 1,
    walkability: 72,
    vibe: "A-",
    safety: 78,
    amenities: 65,
    schools: 68,
    summary:
      "A strong balance of short drive times, reliable transit, and walkable amenities near parks and local shops.",
    coordinates: [-118.191, 34.112],
  },
  {
    id: "culver-city",
    rank: 2,
    name: "Culver City",
    tone: "amber",
    drive: 26,
    transit: 31,
    transfers: 1,
    walkability: 65,
    vibe: "B+",
    safety: 74,
    amenities: 72,
    schools: 70,
    summary:
      "A balanced option for restaurants, office access, and transit coverage with a moderate peak commute.",
    coordinates: [-118.374, 34.019],
  },
  {
    id: "silver-lake",
    rank: 3,
    name: "Silver Lake",
    tone: "amber",
    drive: 31,
    transit: 34,
    transfers: 1,
    walkability: 68,
    vibe: "B+",
    safety: 69,
    amenities: 70,
    schools: 63,
    summary:
      "High lifestyle appeal and strong neighborhood energy, with commute times landing in the moderate range.",
    coordinates: [-118.276, 34.086],
  },
  {
    id: "inglewood",
    rank: 4,
    name: "Inglewood",
    tone: "red",
    drive: 42,
    transit: 49,
    transfers: 2,
    walkability: 55,
    vibe: "B",
    safety: 62,
    amenities: 58,
    schools: 60,
    summary:
      "More reachable rents and useful amenities, but the peak commute is meaningfully longer.",
    coordinates: [-118.337, 33.961],
  },
];

const listings = [
  { rent: "$2,350", meta: "2 bd - 1 ba - 810 sqft", address: "542 N Ave 53" },
  { rent: "$2,100", meta: "1 bd - 1 ba - 640 sqft", address: "120 Marmion Way" },
  { rent: "$2,650", meta: "2 bd - 2 ba - 950 sqft", address: "6043 York Blvd" },
];

const fallbackPositions: Record<string, [number, number]> = {
  "highland-park": [552, 176],
  "culver-city": [195, 435],
  "silver-lake": [278, 270],
  inglewood: [435, 570],
};

function circlePolygon([lng, lat]: [number, number], radius = 0.028) {
  const points = Array.from({ length: 42 }, (_, index) => {
    const angle = (index / 42) * Math.PI * 2;
    const stretch = 1 + Math.sin(angle * 3) * 0.16;
    return [
      lng + Math.cos(angle) * radius * stretch,
      lat + Math.sin(angle) * radius * 0.78 * stretch,
    ] as [number, number];
  });
  return [...points, points[0]];
}

function buildMapData(selectedId: string) {
  return {
    routes: {
      type: "FeatureCollection" as const,
      features: neighborhoods.map((item) => ({
        type: "Feature" as const,
        properties: {
          id: item.id,
          color: colors[item.tone],
          selected: item.id === selectedId,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            WORKPLACE,
            [
              (WORKPLACE[0] + item.coordinates[0]) / 2 + (item.rank % 2 ? 0.011 : -0.014),
              (WORKPLACE[1] + item.coordinates[1]) / 2 + (item.rank % 2 ? 0.004 : -0.003),
            ],
            item.coordinates,
          ],
        },
      })),
    },
    zones: {
      type: "FeatureCollection" as const,
      features: neighborhoods.map((item) => ({
        type: "Feature" as const,
        properties: {
          id: item.id,
          color: colors[item.tone],
          selected: item.id === selectedId,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [circlePolygon(item.coordinates, item.id === selectedId ? 0.034 : 0.028)],
        },
      })),
    },
    labels: {
      type: "FeatureCollection" as const,
      features: neighborhoods.map((item) => ({
        type: "Feature" as const,
        properties: {
          id: item.id,
          rank: String(item.rank),
          color: colors[item.tone],
          selected: item.id === selectedId,
        },
        geometry: { type: "Point" as const, coordinates: item.coordinates },
      })),
    },
    workplace: {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: WORKPLACE },
    },
  };
}

function Topbar() {
  return (
    <header className="dashboard-topbar">
      <a className="dashboard-logo" href="/" aria-label="RelocateIQ home">
        <span>+</span>
        <strong>RelocateIQ</strong>
      </a>
      <label className="dashboard-search" htmlFor="dashboard-workplace">
        <span aria-hidden="true" />
        <input id="dashboard-workplace" defaultValue="800 Wilshire Blvd, Los Angeles" />
      </label>
      <div className="dashboard-radius">
        <small>Search radius</small>
        <strong>15 mi</strong>
      </div>
      <div className="mode-toggle" aria-label="Commute mode">
        <button className="is-active" type="button">Drive</button>
        <button type="button">Transit</button>
      </div>
      <label className="traffic-toggle">
        <input type="checkbox" defaultChecked readOnly />
        <span />
        Live traffic
      </label>
    </header>
  );
}

function ResultsPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="results-panel" aria-label="Top neighborhoods">
      <div className="panel-title-row">
        <div>
          <h1>Top neighborhoods</h1>
          <p>Ranked by total commute time</p>
        </div>
        <span>20 areas</span>
      </div>
      <div className="results-list">
        {neighborhoods.map((item) => (
          <button
            className={`result-card result-card--${item.tone} ${item.id === selectedId ? "is-selected" : ""}`}
            type="button"
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span className={`dashboard-rank dashboard-rank--${item.tone}`}>{item.rank}</span>
            <div className="result-card__body">
              <div className="result-card__headline">
                <strong>{item.name}</strong>
                <b>{item.drive} min</b>
              </div>
              <div className="result-card__metrics">
                <span>Drive {item.drive} min</span>
                <span>Transit {item.transit} min</span>
              </div>
              <div className="result-card__chips">
                <span>Walkability {item.walkability}</span>
                <span>Vibe {item.vibe}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button className="show-more-button" type="button">Show more neighborhoods</button>
    </aside>
  );
}

function DashboardMap({
  selected,
  onSelect,
}: {
  selected: Neighborhood;
  onSelect: (id: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [failed, setFailed] = useState(false);
  const mapData = useMemo(() => buildMapData(selected.id), [selected.id]);

  useEffect(() => {
    if (!HAS_MAPBOX_TOKEN || !mapContainerRef.current) return;

    let cancelled = false;

    async function initMap() {
      const { default: mapboxgl } = await import("mapbox-gl");
      if (cancelled || !mapContainerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-118.276, 34.038],
        zoom: 11.15,
        bearing: -7,
        interactive: true,
        attributionControl: true,
        logoPosition: "bottom-right",
      });
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("dashboard-routes", { type: "geojson", data: mapData.routes });
        map.addSource("dashboard-zones", { type: "geojson", data: mapData.zones });
        map.addSource("dashboard-zone-labels", { type: "geojson", data: mapData.labels });
        map.addSource("dashboard-workplace", { type: "geojson", data: mapData.workplace });

        map.addLayer({
          id: "dashboard-zone-fill",
          type: "fill",
          source: "dashboard-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": ["case", ["get", "selected"], 0.24, 0.14],
          },
        });
        map.addLayer({
          id: "dashboard-zone-outline",
          type: "line",
          source: "dashboard-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["get", "selected"], 3.4, 2],
            "line-opacity": ["case", ["get", "selected"], 0.9, 0.5],
          },
        });
        map.addLayer({
          id: "dashboard-route-line",
          type: "line",
          source: "dashboard-routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["get", "selected"], 6, 4],
            "line-opacity": ["case", ["get", "selected"], 0.9, 0.44],
          },
        });
        map.addLayer({
          id: "dashboard-rank-badge",
          type: "circle",
          source: "dashboard-zone-labels",
          paint: {
            "circle-radius": ["case", ["get", "selected"], 24, 21],
            "circle-color": ["get", "color"],
            "circle-opacity": ["case", ["get", "selected"], 0.96, 0.82],
            "circle-stroke-color": "#fffdf8",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "dashboard-rank-text",
          type: "symbol",
          source: "dashboard-zone-labels",
          layout: {
            "text-field": ["get", "rank"],
            "text-size": 18,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": "#fffdf8" },
        });
        map.addLayer({
          id: "dashboard-workplace-marker",
          type: "circle",
          source: "dashboard-workplace",
          paint: {
            "circle-radius": 14,
            "circle-color": "#f3a428",
            "circle-stroke-color": "#fffdf8",
            "circle-stroke-width": 5,
          },
        });

        ["dashboard-zone-fill", "dashboard-rank-badge", "dashboard-rank-text"].forEach((layer) => {
          map.on("click", layer, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") onSelect(id);
          });
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        });
        map.resize();
      });

      map.on("error", () => setFailed(true));
    }

    initMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const sources = [
      ["dashboard-routes", mapData.routes],
      ["dashboard-zones", mapData.zones],
      ["dashboard-zone-labels", mapData.labels],
    ] as const;
    sources.forEach(([id, data]) => {
      const source = map.getSource(id);
      if (source && "setData" in source) source.setData(data);
    });
  }, [mapData]);

  if (!HAS_MAPBOX_TOKEN || failed) {
    return <FallbackMap selected={selected} onSelect={onSelect} />;
  }

  return (
    <section className="map-shell" aria-label="Ranked commute map">
      <div className="dashboard-mapbox" ref={mapContainerRef} />
      <MapChrome />
    </section>
  );
}

function FallbackMap({
  selected,
  onSelect,
}: {
  selected: Neighborhood;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="map-shell map-shell--fallback" aria-label="Ranked commute map">
      <img src={mapPreview} alt="" />
      <svg className="map-drawing" viewBox="0 0 760 720" preserveAspectRatio="none" aria-hidden="true">
        <circle className="radius-ring" cx="380" cy="345" r="165" />
        <circle className="radius-ring radius-ring--wide" cx="380" cy="345" r="250" />
        {neighborhoods.map((item) => {
          const [x, y] = fallbackPositions[item.id];
          return (
            <path
              key={item.id}
              className={`fallback-route fallback-route--${item.tone}${item.id === selected.id ? " is-selected" : ""}`}
              d={`M380 345 C ${x - 44} ${y - 24}, ${x - 28} ${y + 34}, ${x} ${y}`}
            />
          );
        })}
        <circle className="workplace-dot" cx="380" cy="345" r="20" />
      </svg>
      <div className="map-zone-buttons">
        {neighborhoods.map((item) => {
          const [x, y] = fallbackPositions[item.id];
          return (
            <button
              className={`map-zone-button map-zone-button--${item.tone}${item.id === selected.id ? " is-selected" : ""}`}
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{ left: `${(x / 760) * 100}%`, top: `${(y / 720) * 100}%` }}
              aria-label={`Select ${item.name}`}
            >
              {item.rank}
            </button>
          );
        })}
      </div>
      <MapChrome />
    </section>
  );
}

function MapChrome() {
  return (
    <>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in">+</button>
        <button type="button" aria-label="Zoom out">-</button>
        <button type="button" aria-label="Reset map">⌖</button>
      </div>
      <div className="map-floating departure-control">
        <strong>Departure</strong>
        <input type="range" min="0" max="100" defaultValue="58" aria-label="Departure time" />
        <button type="button">7:30 AM</button>
      </div>
    </>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "green" : value >= 60 ? "amber" : "red";
  return (
    <div className="score-row">
      <span>{label}</span>
      <div className="score-track">
        <i className={`score-fill score-fill--${tone}`} style={{ width: `${value}%` }} />
      </div>
      <b>{value}</b>
    </div>
  );
}

function DetailPanel({ selected }: { selected: Neighborhood }) {
  return (
    <aside className="zone-panel" aria-label={`${selected.name} details`}>
      <div className={`zone-panel__header zone-panel__header--${selected.tone}`}>
        <span className={`dashboard-rank dashboard-rank--${selected.tone}`}>{selected.rank}</span>
        <div>
          <h2>{selected.name}</h2>
          <p><strong>{selected.drive} min</strong> total commute</p>
        </div>
        <button type="button" aria-label="Save neighborhood">♡</button>
      </div>
      <section className="commute-summary" aria-label="Commute breakdown">
        <article>
          <small>Drive</small>
          <strong>{selected.drive} min</strong>
          <p>12.4 miles</p>
        </article>
        <article>
          <small>Transit</small>
          <strong>{selected.transit} min</strong>
          <p>{selected.transfers} transfer{selected.transfers !== 1 ? "s" : ""}</p>
        </article>
      </section>
      <section className="score-panel">
        <div className="section-title">
          <h3>Lifestyle scores</h3>
          <a href="#scores">See all</a>
        </div>
        <ScoreBar label="Walkability" value={selected.walkability} />
        <ScoreBar label="Safety" value={selected.safety} />
        <ScoreBar label="Amenities" value={selected.amenities} />
        <ScoreBar label="Schools" value={selected.schools} />
      </section>
      <section className="ai-panel">
        <div className="section-title">
          <h3>AI explanation <span>BETA</span></h3>
          <b>✦</b>
        </div>
        <p>{selected.summary}</p>
        <ul>
          <li>Strong commute fit compared with nearby neighborhoods</li>
          <li>Walkability and daily-life scores are already listing-ready</li>
        </ul>
      </section>
      <section className="listing-panel">
        <div className="section-title">
          <h3>Listings in {selected.name}</h3>
          <a href="#listings">View all</a>
        </div>
        <div className="listing-grid">
          {listings.map((listing, index) => (
            <article className="listing-card" key={listing.address}>
              <div className={`listing-photo listing-photo--${index + 1}`} />
              <strong>{listing.rent}<small>/mo</small></strong>
              <p>{listing.meta}</p>
              <p>{listing.address}</p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function DashboardPage() {
  const [selectedId, setSelectedId] = useState(neighborhoods[0].id);
  const selected = neighborhoods.find((item) => item.id === selectedId) ?? neighborhoods[0];

  return (
    <main className="dashboard-page">
      <Topbar />
      <div className="dashboard-workspace">
        <ResultsPanel selectedId={selected.id} onSelect={setSelectedId} />
        <DashboardMap selected={selected} onSelect={setSelectedId} />
        <DetailPanel selected={selected} />
      </div>
    </main>
  );
}
