import { useEffect, useRef, useState } from 'react'
import {
  Layer,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from '@vis.gl/react-maplibre'
import type { FeatureCollection, Geometry } from 'geojson'
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
import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import { moveMapToGeographicScope } from './geographicMapCamera'
import type { BoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'
import {
  TAXALENS_BASELINE_EVIDENCE_LAYER,
  TAXALENS_FLICKR_PENDING_LAYER,
  TAXALENS_FLICKR_RELEASE_READY_LAYER,
  TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER,
  TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER,
  TAXALENS_FLICKR_UNCERTAIN_LAYER,
  TAXALENS_IMPACT_CELL_SOURCE_ID,
  TAXALENS_IMPACT_INTERACTIVE_LAYER_IDS,
} from './geographicImpactLayers'
import { registerGeographicEvidenceImages } from './geographicEvidenceIcons'
import { GEOGRAPHIC_BUBBLE_SCALE_CAPTION } from './geographicBubbleScale'
import type { GeographicImpactMapFeature } from './geographicImpactFeatureCollection'
import { GeographicImpactCellTooltip } from './GeographicImpactCellTooltip'
import './geographicImpactMap.css'

export const TAXALENS_MAP_ACCESSIBLE_NAME =
  'TaxaLens Geographic Impact world map' as const

export function OfflineWorldMap({
  onCountrySelect,
  onImpactCellSelect,
  impactFeatures,
  selectedImpactCellId,
  selectedScope = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root,
  webGlSupported,
}: {
  readonly onCountrySelect?: (countryCode: string) => void
  readonly onImpactCellSelect?: (spatialCellId: string | null) => void
  readonly impactFeatures?: BoundedGeographicImpactFeatures
  readonly selectedImpactCellId?: string | null
  readonly selectedScope?: CountryHierarchyNode
  readonly webGlSupported?: boolean
}) {
  const supported = webGlSupported ?? browserSupportsWebGl()
  const mapRef = useRef<MapRef>(null)
  const pendingCameraScope = useRef<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [evidenceImagesReady, setEvidenceImagesReady] = useState(false)
  const [cameraScopeId, setCameraScopeId] = useState<string | null>(null)
  const [internalSelectedImpactCellId, setInternalSelectedImpactCellId] =
    useState<string | null>(null)
  const effectiveSelectedImpactCellId =
    selectedImpactCellId === undefined
      ? internalSelectedImpactCellId
      : selectedImpactCellId
  const selectedImpactFeature =
    impactFeatures?.collection.features.find(
      ({ properties }) => properties.spatialCellId === effectiveSelectedImpactCellId,
    ) ?? null
  const selectImpactCell = (spatialCellId: string | null) => {
    if (selectedImpactCellId === undefined) {
      setInternalSelectedImpactCellId(spatialCellId)
    }
    onImpactCellSelect?.(spatialCellId)
  }

  useEffect(() => {
    if (!loaded || mapRef.current === null) return
    pendingCameraScope.current = selectedScope.scope_id
    moveMapToGeographicScope(mapRef.current, selectedScope)
  }, [loaded, selectedScope])

  useEffect(() => {
    if (!loaded || impactFeatures === undefined || mapRef.current === null) return
    try {
      registerGeographicEvidenceImages(mapRef.current.getMap())
      setEvidenceImagesReady(true)
    } catch (error) {
      setRuntimeError(
        error instanceof Error ? error.message : 'local evidence images could not be registered',
      )
    }
  }, [impactFeatures, loaded])

  useEffect(() => {
    if (
      effectiveSelectedImpactCellId !== null &&
      selectedImpactFeature === null
    ) {
      if (selectedImpactCellId === undefined) setInternalSelectedImpactCellId(null)
      onImpactCellSelect?.(null)
    }
  }, [
    effectiveSelectedImpactCellId,
    impactFeatures,
    onImpactCellSelect,
    selectedImpactCellId,
    selectedImpactFeature,
  ])

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
      <div
        className="taxalens-world-map__canvas"
        data-camera-scope={cameraScopeId ?? 'pending'}
        data-baseline-evidence={
          impactFeatures !== undefined &&
          impactFeatures.collection.features.some(({ properties }) => properties.baselineCount > 0)
            ? 'true'
            : 'false'
        }
        data-impact-feature-count={impactFeatures?.emittedFeatureCount ?? 0}
        data-flickr-evidence={
          impactFeatures !== undefined &&
          impactFeatures.collection.features.some(
            ({ properties }) => properties.flickrCandidateCount > 0,
          )
            ? 'true'
            : 'false'
        }
        data-map-loaded={loaded ? 'true' : 'false'}
        data-selected-scope={selectedScope.scope_id}
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 0,
            latitude: 12,
            zoom: 0,
          }}
          mapStyle={TAXALENS_OFFLINE_MAP_STYLE}
          interactiveLayerIds={
            impactFeatures === undefined
              ? [TAXALENS_SELECTABLE_COUNTRY_LAYER_ID]
              : [
                  TAXALENS_SELECTABLE_COUNTRY_LAYER_ID,
                  ...TAXALENS_IMPACT_INTERACTIVE_LAYER_IDS,
                ]
          }
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
          onClick={(event) =>
            selectMapFeatureFromEvent(
              event,
              impactFeatures,
              (feature) => selectImpactCell(feature?.properties.spatialCellId ?? null),
              onCountrySelect,
            )
          }
          onMoveEnd={() => {
            if (pendingCameraScope.current !== null) {
              setCameraScopeId(pendingCameraScope.current)
              pendingCameraScope.current = null
            }
          }}
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
          {impactFeatures === undefined ? null : (
            <Source
              id={TAXALENS_IMPACT_CELL_SOURCE_ID}
              type="geojson"
              data={impactFeatures.collection as unknown as FeatureCollection<Geometry>}
            >
              <Layer {...TAXALENS_BASELINE_EVIDENCE_LAYER} />
              <Layer {...TAXALENS_FLICKR_PENDING_LAYER} />
              <Layer {...TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER} />
              {evidenceImagesReady ? (
                <>
                  <Layer {...TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER} />
                  <Layer {...TAXALENS_FLICKR_UNCERTAIN_LAYER} />
                </>
              ) : null}
              <Layer {...TAXALENS_FLICKR_RELEASE_READY_LAYER} />
            </Source>
          )}
          <NavigationControl position="top-right" showCompass={false} visualizePitch={false} />
          <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
          {selectedImpactFeature === null ? null : (
            <Popup
              longitude={selectedImpactFeature.geometry.coordinates[0]}
              latitude={selectedImpactFeature.geometry.coordinates[1]}
              anchor="bottom"
              closeButton
              closeOnClick={false}
              maxWidth="22rem"
              className="taxalens-impact-popup"
              onClose={() => selectImpactCell(null)}
            >
              <GeographicImpactCellTooltip feature={selectedImpactFeature} />
            </Popup>
          )}
        </Map>
        <span className="sr-only" role="status" aria-live="polite">
          {loaded
            ? `Offline world map ready for ${selectedScope.scope_name}.`
            : 'Opening offline world map.'}
        </span>
      </div>
      <MapCaption
        {...(impactFeatures === undefined ? {} : { impactFeatures })}
      />
    </figure>
  )
}

function selectMapFeatureFromEvent(
  event: MapLayerMouseEvent,
  impactFeatures: BoundedGeographicImpactFeatures | undefined,
  selectImpactFeature: (feature: GeographicImpactMapFeature | null) => void,
  onCountrySelect: ((countryCode: string) => void) | undefined,
): void {
  const spatialCellId = event.features?.find(({ layer }) =>
    TAXALENS_IMPACT_INTERACTIVE_LAYER_IDS.includes(
      layer?.id as (typeof TAXALENS_IMPACT_INTERACTIVE_LAYER_IDS)[number],
    ),
  )?.properties.spatialCellId
  if (typeof spatialCellId === 'string' && impactFeatures !== undefined) {
    const selected = impactFeatures.collection.features.find(
      ({ properties }) => properties.spatialCellId === spatialCellId,
    )
    if (selected !== undefined) {
      selectImpactFeature(selected)
      return
    }
  }
  selectImpactFeature(null)
  const countryCode = event.features?.find(
    ({ properties }) => typeof properties.country_code === 'string',
  )?.properties.country_code
  if (typeof countryCode === 'string' && countryCode !== '') {
    onCountrySelect?.(countryCode)
  }
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

function MapCaption({
  impactFeatures,
}: {
  readonly impactFeatures?: BoundedGeographicImpactFeatures
} = {}) {
  return (
    <figcaption id="taxalens-world-map-caption">
      {impactFeatures === undefined ? null : (
        <>
          Blue bubbles show deduplicated, range-inference-eligible baseline occurrence evidence.{' '}
          Amber rings, fills, excluded marks, dashed rings and dark-stroked fills distinguish
          Flickr candidate maturity states; candidates remain hypotheses.{' '}
          {GEOGRAPHIC_BUBBLE_SCALE_CAPTION}{' '}
        </>
      )}
      Low-resolution Natural Earth boundaries are for display and navigation only. Made with
      Natural Earth. Rendered locally with MapLibre GL JS; no external tiles, fonts, sprites,
      telemetry or analytics are requested.
    </figcaption>
  )
}
