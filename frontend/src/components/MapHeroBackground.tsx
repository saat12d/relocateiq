import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mapPreview from "../assets/home-map.png";

type RouteTone = "green" | "amber" | "blue" | "red";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const HAS_MAPBOX_TOKEN = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== "your_mapbox_public_token_here");
const WORKPLACE: [number, number] = [-118.255, 34.049];

const routes: Array<{ id: RouteTone; coordinates: [number, number][] }> = [
  {
    id: "green",
    coordinates: [WORKPLACE, [-118.238, 34.064], [-118.212, 34.085], [-118.191, 34.112]],
  },
  {
    id: "amber",
    coordinates: [WORKPLACE, [-118.286, 34.052], [-118.334, 34.063], [-118.374, 34.083]],
  },
  {
    id: "blue",
    coordinates: [WORKPLACE, [-118.246, 34.032], [-118.225, 34.012], [-118.203, 33.992]],
  },
  {
    id: "red",
    coordinates: [WORKPLACE, [-118.266, 34.025], [-118.292, 33.996], [-118.315, 33.968]],
  },
];

const zones: Array<{ id: RouteTone; rank: number; center: [number, number] }> = [
  { id: "green", rank: 1, center: [-118.191, 34.112] },
  { id: "amber", rank: 2, center: [-118.374, 34.083] },
  { id: "blue", rank: 3, center: [-118.203, 33.992] },
  { id: "red", rank: 4, center: [-118.315, 33.968] },
];

const colors: Record<RouteTone, string> = {
  green: "#4f9d52",
  amber: "#f3a428",
  blue: "#2377a8",
  red: "#d84f3f",
};

function circlePolygon([lng, lat]: [number, number], radius = 0.018) {
  const points = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return [lng + Math.cos(angle) * radius, lat + Math.sin(angle) * radius] as [number, number];
  });
  return [...points, points[0]];
}

function addDemoLayers(map: MapboxMap) {
  const routeFeatures = routes.map((route) => ({
    type: "Feature" as const,
    properties: { tone: route.id },
    geometry: { type: "LineString" as const, coordinates: route.coordinates },
  }));

  const zoneFeatures = zones.map((zone) => ({
    type: "Feature" as const,
    properties: { tone: zone.id, rank: zone.rank },
    geometry: { type: "Polygon" as const, coordinates: [circlePolygon(zone.center)] },
  }));

  map.addSource("demo-routes", {
    type: "geojson",
    data: { type: "FeatureCollection", features: routeFeatures },
  });
  map.addSource("demo-zones", {
    type: "geojson",
    data: { type: "FeatureCollection", features: zoneFeatures },
  });
  map.addSource("workplace", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: WORKPLACE } },
  });

  map.addLayer({
    id: "demo-zone-fill",
    type: "fill",
    source: "demo-zones",
    paint: {
      "fill-color": ["match", ["get", "tone"], "green", colors.green, "amber", colors.amber, "blue", colors.blue, colors.red],
      "fill-opacity": 0.18,
    },
  });
  map.addLayer({
    id: "demo-zone-outline",
    type: "line",
    source: "demo-zones",
    paint: {
      "line-color": ["match", ["get", "tone"], "green", colors.green, "amber", colors.amber, "blue", colors.blue, colors.red],
      "line-width": 2.5,
      "line-opacity": 0.72,
    },
  });
  map.addLayer({
    id: "demo-route-line",
    type: "line",
    source: "demo-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "tone"], "green", colors.green, "amber", colors.amber, "blue", colors.blue, colors.red],
      "line-width": 5,
      "line-opacity": 0.82,
    },
  });
  map.addLayer({
    id: "workplace-marker",
    type: "circle",
    source: "workplace",
    paint: {
      "circle-radius": 12,
      "circle-color": colors.amber,
      "circle-stroke-color": "#fffdf8",
      "circle-stroke-width": 5,
    },
  });
}

function StaticMapFallback() {
  return <img className="hero-map" src={mapPreview} alt="City map with ranked commute routes" />;
}

function MapHeroBackground() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!HAS_MAPBOX_TOKEN || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;
    let map: MapboxMap | undefined;

    async function initMap() {
      const { default: mapboxgl } = await import("mapbox-gl");

      if (cancelled || !mapContainerRef.current) {
        return;
      }

      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: WORKPLACE,
        zoom: 11.1,
        pitch: 0,
        bearing: -7,
        interactive: false,
        attributionControl: true,
        logoPosition: "bottom-right",
      });

      map.on("load", () => map && addDemoLayers(map));
      map.on("error", () => setFailed(true));
    }

    initMap();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  if (!HAS_MAPBOX_TOKEN || failed) {
    return <StaticMapFallback />;
  }

  return <div className="hero-map hero-map--mapbox" ref={mapContainerRef} aria-hidden="true" />;
}

export default MapHeroBackground;
