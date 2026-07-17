import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mapMocks = vi.hoisted(() => ({
  mapProps: [] as Array<Record<string, unknown>>,
}))

vi.mock('@vis.gl/react-maplibre', () => ({
  Map: ({ children, ...props }: { readonly children: ReactNode }) => {
    mapMocks.mapProps.push(props)
    return <div data-testid="maplibre-map">{children}</div>
  },
  Source: ({ children, type }: { readonly children: ReactNode; readonly type: string }) => (
    <div data-testid="maplibre-source" data-source-type={type}>{children}</div>
  ),
  Layer: ({ id, type }: { readonly id: string; readonly type: string }) => (
    <span data-testid="maplibre-layer" data-layer-id={id} data-layer-type={type} />
  ),
  NavigationControl: () => <button type="button">Map navigation</button>,
  ScaleControl: () => <span>Map scale</span>,
}))

import { GeographicImpactLens } from './GeographicImpactLens'
import { OfflineWorldMap, TAXALENS_MAP_ACCESSIBLE_NAME } from './OfflineWorldMap'

describe('OfflineWorldMap', () => {
  it('passes only local style and GeoJSON objects to the renderer', () => {
    render(<OfflineWorldMap webGlSupported />)

    expect(screen.getByTestId('maplibre-map')).toBeInTheDocument()
    expect(screen.getByTestId('maplibre-source')).toHaveAttribute('data-source-type', 'geojson')
    expect(screen.getAllByTestId('maplibre-layer')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Map navigation' })).toBeInTheDocument()
    expect(screen.getByText('Map scale')).toBeInTheDocument()
    expect(screen.getByText(/no external tiles, fonts, sprites, telemetry or analytics/u))
      .toBeInTheDocument()

    const props = mapMocks.mapProps.at(-1)
    expect(props?.mapStyle).toMatchObject({ version: 8, sources: {} })
    expect(props?.attributionControl).toBe(false)
    expect(props?.maplibreLogo).toBe(false)
    expect(props?.renderWorldCopies).toBe(false)
    expect(props).not.toHaveProperty('maxBounds')
    expect(props?.initialViewState).toEqual({ latitude: 12, longitude: 0, zoom: 0 })
    expect(props?.locale).toEqual({ 'Map.Title': TAXALENS_MAP_ACCESSIBLE_NAME })
  })

  it('provides a clear table-oriented alternative when WebGL is unavailable', () => {
    render(<OfflineWorldMap webGlSupported={false} />)

    expect(screen.queryByTestId('maplibre-map')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'World map rendering unavailable' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/synchronized table/u)).toBeInTheDocument()
  })

  it('keeps the cartographic foundation separate from unsupported impact claims', () => {
    render(<GeographicImpactLens webGlSupported={false} />)

    expect(
      screen.getByRole('heading', { name: 'TaxaLens Geographic Impact Lens' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/does not yet display an impact claim/u)).toBeInTheDocument()
    expect(screen.getByText(/hosted v1 replay does not publish/u)).toBeInTheDocument()
  })
})
