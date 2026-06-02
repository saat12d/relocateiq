import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mapPreview from "../../assets/home-map.png";
import {
  Neighborhood,
  neighborhoods,
  colors,
  fallbackPositions,
  WORKPLACE,
} from "./data";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const HAS_MAPBOX_TOKEN = Boolean(
  MAPBOX_TOKEN && MAPBOX_TOKEN !== "your_mapbox_public_token_here",
);

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
              (WORKPLACE[0] + item.coordinates[0]) / 2 +
                (item.rank % 2 ? 0.011 : -0.014),
              (WORKPLACE[1] + item.coordinates[1]) / 2 +
                (item.rank % 2 ? 0.004 : -0.003),
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
          coordinates: [
            circlePolygon(
              item.coordinates,
              item.id === selectedId ? 0.034 : 0.028,
            ),
          ],
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

function MapChrome() {
  return (
    <>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in">
          +
        </button>
        <button type="button" aria-label="Zoom out">
          -
        </button>
        <button type="button" aria-label="Reset map">
          ⌖
        </button>
      </div>
      <div className="map-floating departure-control">
        <strong>Departure</strong>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="58"
          aria-label="Departure time"
        />
        <button type="button">7:30 AM</button>
      </div>
    </>
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
    <section
      className="map-shell map-shell--fallback"
      aria-label="Ranked commute map"
    >
      <img src={mapPreview} alt="" />
      <svg
        className="map-drawing"
        viewBox="0 0 760 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <circle className="radius-ring" cx="380" cy="345" r="165" />
        <circle
          className="radius-ring radius-ring--wide"
          cx="380"
          cy="345"
          r="250"
        />
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
              style={{
                left: `${(x / 760) * 100}%`,
                top: `${(y / 720) * 100}%`,
              }}
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

export default function DashboardMap({
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
        map.addSource("dashboard-routes", {
          type: "geojson",
          data: mapData.routes,
        });
        map.addSource("dashboard-zones", {
          type: "geojson",
          data: mapData.zones,
        });
        map.addSource("dashboard-zone-labels", {
          type: "geojson",
          data: mapData.labels,
        });
        map.addSource("dashboard-workplace", {
          type: "geojson",
          data: mapData.workplace,
        });

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

        [
          "dashboard-zone-fill",
          "dashboard-rank-badge",
          "dashboard-rank-text",
        ].forEach((layer) => {
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
