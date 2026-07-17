import { useState } from 'react'
import {
  Layer,
  Map,
  NavigationControl,
  ScaleControl,
  Source,
} from '@vis.gl/react-maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  TAXALENS_BOUNDARY_ONLY_LAYER,
  TAXALENS_COUNTRY_BOUNDARIES,
  TAXALENS_COUNTRY_LINE_LAYER,
  TAXALENS_COUNTRY_SOURCE_ID,
  TAXALENS_OFFLINE_MAP_STYLE,
  TAXALENS_SELECTABLE_COUNTRY_LAYER,
  TAXALENS_SELECTABLE_COUNTRY_LAYER_ID,
} from './offlineMapStyle'
import './geographicImpactMap.css'

export const TAXALENS_MAP_ACCESSIBLE_NAME =
  'TaxaLens Geographic Impact world map' as const

export function OfflineWorldMap({
  webGlSupported,
}: {
  readonly webGlSupported?: boolean
}) {
  const supported = webGlSupported ?? browserSupportsWebGl()
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  if (!supported || runtimeError !== null) {
    return (
      <figure className="taxalens-world-map taxalens-world-map--fallback">
        <div role="img" aria-labelledby="taxalens-world-map-fallback-title">
          <p className="eyebrow">Static geographic alternative</p>
          <h4 id="taxalens-world-map-fallback-title">World map rendering unavailable</h4>
          <p>
            {runtimeError === null
              ? 'This browser does not expose WebGL. Geographic evidence remains available through the synchronized table when impact layers are connected.'
              : `The local map renderer stopped: ${runtimeError}`}
          </p>
        </div>
        <MapCaption />
      </figure>
    )
  }

  return (
    <figure className="taxalens-world-map" aria-labelledby="taxalens-world-map-caption">
      <div className="taxalens-world-map__canvas" data-map-loaded={loaded ? 'true' : 'false'}>
        <Map
          initialViewState={{
            longitude: 0,
            latitude: 12,
            zoom: 0,
          }}
          mapStyle={TAXALENS_OFFLINE_MAP_STYLE}
          interactiveLayerIds={[TAXALENS_SELECTABLE_COUNTRY_LAYER_ID]}
          attributionControl={false}
          maplibreLogo={false}
          renderWorldCopies={false}
          // Exact-world maxBounds can make MapLibre's resize constraint singular when the
          // viewport is wider than the zoom-zero world. Scope-specific bounds belong to the
          // controlled drilldown camera added in Task 4.2.
          minZoom={0}
          maxZoom={10}
          maxPitch={0}
          dragRotate={false}
          touchPitch={false}
          cooperativeGestures
          locale={{ 'Map.Title': TAXALENS_MAP_ACCESSIBLE_NAME }}
          onLoad={() => setLoaded(true)}
          onError={({ error }) => setRuntimeError(error.message)}
        >
          <Source
            id={TAXALENS_COUNTRY_SOURCE_ID}
            type="geojson"
            data={TAXALENS_COUNTRY_BOUNDARIES}
          >
            <Layer {...TAXALENS_SELECTABLE_COUNTRY_LAYER} />
            <Layer {...TAXALENS_BOUNDARY_ONLY_LAYER} />
            <Layer {...TAXALENS_COUNTRY_LINE_LAYER} />
          </Source>
          <NavigationControl position="top-right" showCompass={false} visualizePitch={false} />
          <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
        </Map>
        <span className="sr-only" role="status" aria-live="polite">
          {loaded ? 'Offline world map ready.' : 'Opening offline world map.'}
        </span>
      </div>
      <MapCaption />
    </figure>
  )
}

export function browserSupportsWebGl(): boolean {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof window.WebGLRenderingContext === 'undefined'
  ) {
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function MapCaption() {
  return (
    <figcaption id="taxalens-world-map-caption">
      Low-resolution Natural Earth boundaries are for display and navigation only. Made with
      Natural Earth. Rendered locally with MapLibre GL JS; no external tiles, fonts, sprites,
      telemetry or analytics are requested.
    </figcaption>
  )
}
