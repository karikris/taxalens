import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mapMocks = vi.hoisted(() => ({
  camera: {
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
  },
  mapProps: [] as Array<Record<string, unknown>>,
}))

vi.mock('@vis.gl/react-maplibre', () => ({
  Map: ({
    children,
    ref,
    ...props
  }: {
    readonly children: ReactNode
    readonly ref?: { current: unknown }
  }) => {
    if (ref !== undefined) ref.current = mapMocks.camera
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
  beforeEach(() => {
    window.history.replaceState(null, '', '/#dashboard')
    mapMocks.mapProps.length = 0
    mapMocks.camera.fitBounds.mockReset()
    mapMocks.camera.flyTo.mockReset()
    mapMocks.camera.jumpTo.mockReset()
  })

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

  it('synchronizes an exact selectable map feature with scope controls and camera', () => {
    render(<GeographicImpactLens webGlSupported />)
    const initialProps = mapMocks.mapProps.at(-1)

    act(() => (initialProps?.onLoad as () => void)())
    expect(mapMocks.camera.jumpTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [0, 0], zoom: 0 }),
    )

    act(() => {
      ;(initialProps?.onClick as (event: unknown) => void)({
        features: [{ properties: { country_code: null } }],
      })
    })
    expect(window.location.hash).toBe('#dashboard')

    act(() => {
      ;(initialProps?.onClick as (event: unknown) => void)({
        features: [{ properties: { country_code: 'IN' } }],
      })
    })
    expect(window.location.hash).toBe('#dashboard?geo=country%3AIN')
    expect(screen.getByRole('combobox', { name: 'Continent' })).toHaveValue('continent:asia')
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('country:IN')
    expect(mapMocks.camera.fitBounds).toHaveBeenCalled()
  })
})
