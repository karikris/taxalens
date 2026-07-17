import type { MapRef } from '@vis.gl/react-maplibre'

import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'

export type GeographicCameraMode = 'global_jump' | 'bounded_fit' | 'full_span_center'

type GeographicMapCamera = Pick<MapRef, 'fitBounds' | 'flyTo' | 'jumpTo'>

const CAMERA_DURATION_MS = 650
const CAMERA_PADDING_PX = 36

export function moveMapToGeographicScope(
  camera: GeographicMapCamera,
  scope: CountryHierarchyNode,
): GeographicCameraMode {
  const center: [number, number] = [scope.centroid_longitude, scope.centroid_latitude]
  if (scope.scope_level === 'global') {
    camera.jumpTo({ bearing: 0, center, pitch: 0, zoom: 0 })
    return 'global_jump'
  }

  const [west, south, east, north] = scope.bounds
  if (Math.abs(east - west) >= 359.999) {
    camera.flyTo({
      bearing: 0,
      center,
      duration: CAMERA_DURATION_MS,
      essential: false,
      pitch: 0,
      zoom: fullSpanFallbackZoom(scope.scope_level),
    })
    return 'full_span_center'
  }

  camera.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      duration: CAMERA_DURATION_MS,
      essential: false,
      maxZoom: maximumScopeZoom(scope.scope_level),
      padding: CAMERA_PADDING_PX,
    },
  )
  return 'bounded_fit'
}

function maximumScopeZoom(level: CountryHierarchyNode['scope_level']): number {
  if (level === 'continent') return 4
  if (level === 'country') return 7
  if (level === 'admin1') return 9
  return 0
}

function fullSpanFallbackZoom(level: CountryHierarchyNode['scope_level']): number {
  if (level === 'continent') return 1.25
  if (level === 'country') return 1.75
  if (level === 'admin1') return 3
  return 0
}
