import type { FeatureCollection, Geometry } from 'geojson'
import type { LayerProps, StyleSpecification } from '@vis.gl/react-maplibre'

import boundaryText from '../../../../demo/source/geography/natural_earth_110m_countries.geojson?raw'

export const TAXALENS_COUNTRY_SOURCE_ID = 'taxalens-offline-countries'
export const TAXALENS_SELECTABLE_COUNTRY_LAYER_ID = 'taxalens-selectable-countries'
export const TAXALENS_BOUNDARY_ONLY_LAYER_ID = 'taxalens-boundary-only-countries'
export const TAXALENS_COUNTRY_LINE_LAYER_ID = 'taxalens-country-lines'

export interface TaxaLensBoundaryProperties {
  readonly feature_id: string
  readonly country_code: string | null
  readonly name: string
  readonly continent: string
  readonly selectable_country: boolean
}

export const TAXALENS_COUNTRY_BOUNDARIES = JSON.parse(boundaryText) as FeatureCollection<
  Geometry,
  TaxaLensBoundaryProperties
>

export const TAXALENS_OFFLINE_MAP_STYLE = Object.freeze({
  version: 8,
  name: 'TaxaLens offline geographic canvas',
  sources: {},
  layers: [
    {
      id: 'taxalens-ocean-background',
      type: 'background',
      paint: { 'background-color': '#e8f2f4' },
    },
  ],
} satisfies StyleSpecification)

export const TAXALENS_SELECTABLE_COUNTRY_LAYER = Object.freeze({
  id: TAXALENS_SELECTABLE_COUNTRY_LAYER_ID,
  type: 'fill',
  filter: ['==', ['get', 'selectable_country'], true],
  paint: {
    'fill-color': '#d7e5df',
    'fill-opacity': 0.94,
  },
} satisfies LayerProps)

export const TAXALENS_BOUNDARY_ONLY_LAYER = Object.freeze({
  id: TAXALENS_BOUNDARY_ONLY_LAYER_ID,
  type: 'fill',
  filter: ['==', ['get', 'selectable_country'], false],
  paint: {
    'fill-color': '#d8d7d2',
    'fill-opacity': 0.72,
  },
} satisfies LayerProps)

export const TAXALENS_COUNTRY_LINE_LAYER = Object.freeze({
  id: TAXALENS_COUNTRY_LINE_LAYER_ID,
  type: 'line',
  paint: {
    'line-color': '#50666e',
    'line-opacity': 0.78,
    'line-width': 0.8,
  },
} satisfies LayerProps)
