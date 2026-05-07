import { useEffect, useRef, useState } from 'react'
import { loadMapboxGL } from '../utils/mapboxLoader.js'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const WORKPLACE = {
  name: 'Downtown LA Office',
  coordinates: [-118.259, 34.049],
}

export default function MapView() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const workplaceMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!MAPBOX_TOKEN || !mapContainerRef.current) {
      setMapFailed(true)
      return undefined
    }

    loadMapboxGL()
      .then((mapboxgl) => {
        if (cancelled || !mapContainerRef.current || mapRef.current) return

        mapboxgl.accessToken = MAPBOX_TOKEN
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: WORKPLACE.coordinates,
          zoom: 10.45,
          pitch: 0,
          bearing: -8,
          attributionControl: false,
        })

        mapRef.current = map

        map.on('load', () => {
          if (cancelled) return
          softenMapboxStyle(map)
          addWorkplaceMarker(map, mapboxgl, workplaceMarkerRef)
          requestAnimationFrame(() => map.resize())
          window.setTimeout(() => map.resize(), 250)
          setMapReady(true)
        })

        map.on('error', () => setMapFailed(true))
      })
      .catch(() => setMapFailed(true))

    return () => {
      cancelled = true
      if (workplaceMarkerRef.current) {
        workplaceMarkerRef.current.remove()
        workplaceMarkerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <section className={`map-stage ${mapReady && !mapFailed ? 'mapbox-ready' : ''}`} aria-label="Interactive relocation map">
      <div className="map-fallback" aria-hidden="true">
        <div className="fallback-grid" />
        <div className="fallback-water" />
        <div className="fallback-marker">▦</div>
      </div>
      <div
        className={`mapbox-layer ${mapReady && !mapFailed ? 'visible' : ''}`}
        ref={mapContainerRef}
      />
      {!MAPBOX_TOKEN && (
        <div className="map-token-note">
          Add <code>VITE_MAPBOX_TOKEN</code> for the live Mapbox basemap.
        </div>
      )}
    </section>
  )
}

function softenMapboxStyle(map) {
  const layers = map.getStyle().layers || []

  layers.forEach((layer) => {
    const id = layer.id.toLowerCase()

    try {
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#f4ecda')
      }

      if (id.includes('label') || id.includes('poi') || id.includes('building')) {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
      }

      if (layer.type === 'fill' && id.includes('water')) {
        map.setPaintProperty(layer.id, 'fill-color', '#b9dbe5')
        map.setPaintProperty(layer.id, 'fill-opacity', 0.88)
      }

      if (layer.type === 'fill' && (id.includes('park') || id.includes('landuse') || id.includes('landcover'))) {
        map.setPaintProperty(layer.id, 'fill-color', '#cddbb1')
        map.setPaintProperty(layer.id, 'fill-opacity', 0.48)
      }

      if (layer.type === 'line' && id.includes('road')) {
        const isHighway = id.includes('motorway') || id.includes('trunk') || id.includes('highway')
        map.setPaintProperty(layer.id, 'line-color', isHighway ? '#aaa9a4' : '#d8ccba')
        map.setPaintProperty(layer.id, 'line-opacity', isHighway ? 0.78 : 0.48)
      }
    } catch {
      // Some base style layers use expressions that cannot be overwritten in every style version.
    }
  })
}

function addWorkplaceMarker(map, mapboxgl, markerRef) {
  const marker = document.createElement('div')
  marker.className = 'mapbox-workplace-marker'
  marker.innerHTML = '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15M9 8h2m2 0h2M9 12h2m2 0h2M9 16h2m2 0h2M4 21h16" /></svg>'
  markerRef.current = new mapboxgl.Marker({ element: marker, anchor: 'center' })
    .setLngLat(WORKPLACE.coordinates)
    .addTo(map)
}
