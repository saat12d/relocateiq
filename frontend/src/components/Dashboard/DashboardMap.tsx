import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { CommuteScenario } from "../../models/types";

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

function buildMapData(
  recommendations: CommuteScenario["recommendations"],
  selectedId: string | null,
  workplace: { lat: number; lng: number },
) {
  const workplaceCoords: [number, number] = [
    workplace.longitude,
    workplace.latitude,
  ];

  const DIMMED_COLOR = "#b9b1a6"; // grey for zones that fail the active filters

  const getColor = (rank: number) => {
    if (rank === 1) return "#4f9d52"; // Green
    if (rank <= 3) return "#f3a428"; // Amber
    return "#d84f3f"; // Red
  };

  const colorFor = (item: CommuteScenario["recommendations"][number]) =>
    item.meetsFilters ? getColor(item.rank) : DIMMED_COLOR;

  return {
    routes: {
      type: "FeatureCollection" as const,
      features: recommendations.map((item, index) => {
        const itemCoords: [number, number] = [
          item.zone.centerLng,
          item.zone.centerLat,
        ];
        const rank = index + 1;

        return {
          type: "Feature" as const,
          properties: {
            id: item.zone.zoneId,
            color: colorFor(item),
            dimmed: !item.meetsFilters,
            selected: item.zone.zoneId === selectedId,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              workplaceCoords,
              [
                (workplaceCoords[0] + itemCoords[0]) / 2 +
                  (rank % 2 ? 0.011 : -0.014),
                (workplaceCoords[1] + itemCoords[1]) / 2 +
                  (rank % 2 ? 0.004 : -0.003),
              ],
              itemCoords,
            ],
          },
        };
      }),
    },
    zones: {
      type: "FeatureCollection" as const,
      features: recommendations.map((item) => {
        const itemCoords: [number, number] = [
          item.zone.centerLng,
          item.zone.centerLat,
        ];

        return {
          type: "Feature" as const,
          properties: {
            id: item.zone.zoneId,
            color: colorFor(item),
            dimmed: !item.meetsFilters,
            selected: item.zone.zoneId === selectedId,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              circlePolygon(
                itemCoords,
                item.zone.zoneId === selectedId ? 0.034 : 0.028,
              ),
            ],
          },
        };
      }),
    },
    labels: {
      type: "FeatureCollection" as const,
      features: recommendations.map((item) => {
        const itemCoords: [number, number] = [
          item.zone.centerLng,
          item.zone.centerLat,
        ];

        return {
          type: "Feature" as const,
          properties: {
            id: item.zone.zoneId,
            rank: item.meetsFilters ? String(item.rank) : "—",
            color: colorFor(item),
            dimmed: !item.meetsFilters,
            selected: item.zone.zoneId === selectedId,
          },
          geometry: { type: "Point" as const, coordinates: itemCoords },
        };
      }),
    },
    workplace: {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: workplaceCoords },
    },
  };
}

// Convert minutes-since-midnight to a 24h "HH:MM" value for <input type="time">.
function minutesToTimeValue(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Parse an "HH:MM" time input value back into minutes-since-midnight (or null).
function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

type MapChromeProps = {
  departureMinutes: number;
  onDepartureCommit: (minutes: number) => void;
  isLoading: boolean;
};

function MapChrome({
  departureMinutes,
  onDepartureCommit,
  isLoading,
}: MapChromeProps) {
  // Track the slider value locally so the label updates live while dragging;
  // only re-run the search when the user releases (commits) the slider.
  const [draft, setDraft] = useState(departureMinutes);

  // Stay in sync if the parent resets the value (e.g. after a new search).
  useEffect(() => {
    setDraft(departureMinutes);
  }, [departureMinutes]);

  function commit() {
    if (draft !== departureMinutes) {
      onDepartureCommit(draft);
    }
  }

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
          min={0}
          max={1439}
          step={15}
          value={draft}
          disabled={isLoading}
          onChange={(event) => setDraft(Number(event.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          aria-label="Departure time"
        />
        <input
          type="time"
          className="departure-time-input"
          value={minutesToTimeValue(draft)}
          disabled={isLoading}
          onChange={(event) => {
            const minutes = timeValueToMinutes(event.target.value);
            if (minutes !== null) setDraft(minutes);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label="Departure time"
        />
      </div>
    </>
  );
}

type DashboardMapProps = {
  recommendations: CommuteScenario["recommendations"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  workplace: { latitude: number; longitude: number };
  departureMinutes: number;
  onDepartureCommit: (minutes: number) => void;
  isLoading: boolean;
};

export default function DashboardMap({
  recommendations,
  selectedId,
  onSelect,
  workplace,
  departureMinutes,
  onDepartureCommit,
  isLoading,
}: DashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [failed, setFailed] = useState(false);

  // Rebuild map data whenever the API data or selection changes
  const mapData = useMemo(
    () => buildMapData(recommendations, selectedId, workplace),
    [recommendations, selectedId, workplace],
  );

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
        center: [workplace.longitude, workplace.latitude],
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
            "fill-opacity": [
              "case",
              ["get", "dimmed"],
              0.06,
              ["case", ["get", "selected"], 0.24, 0.14],
            ],
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
            "line-opacity": [
              "case",
              ["get", "dimmed"],
              0.12,
              ["case", ["get", "selected"], 0.9, 0.44],
            ],
          },
        });
        map.addLayer({
          id: "dashboard-rank-badge",
          type: "circle",
          source: "dashboard-zone-labels",
          paint: {
            "circle-radius": ["case", ["get", "selected"], 24, 21],
            "circle-color": ["get", "color"],
            "circle-opacity": [
              "case",
              ["get", "dimmed"],
              0.45,
              ["case", ["get", "selected"], 0.96, 0.82],
            ],
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
      ["dashboard-workplace", mapData.workplace],
    ] as const;
    sources.forEach(([id, data]) => {
      const source = map.getSource(id);
      if (source && "setData" in source) source.setData(data);
    });
  }, [mapData]);

  if (!HAS_MAPBOX_TOKEN || failed) {
    return (
      <div className="dashboard-empty-state">
        Please add your VITE_MAPBOX_TOKEN to the .env file.
      </div>
    );
  }

  return (
    <section className="map-shell" aria-label="Ranked commute map">
      <div className="dashboard-mapbox" ref={mapContainerRef} />
      <MapChrome
        departureMinutes={departureMinutes}
        onDepartureCommit={onDepartureCommit}
        isLoading={isLoading}
      />
    </section>
  );
}
