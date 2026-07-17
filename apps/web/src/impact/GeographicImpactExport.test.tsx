import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  GeographicImpactExport,
  type GeographicImpactExportPreparer,
} from './GeographicImpactExport'
import type { GeographicImpactExportBundle } from './geographicImpactExport'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import {
  PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

describe('GeographicImpactExport', () => {
  it('prepares and lists every independently checksummed local file', async () => {
    const prepare = vi.fn<GeographicImpactExportPreparer>().mockResolvedValue(bundle())
    render(
      <GeographicImpactExport
        data={data()}
        scope={TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root}
        prepare={prepare}
      />,
    )

    expect(screen.getByText(/uploads nothing/u)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare geographic export' }))
    expect(await screen.findByText('Seven geographic export files prepared'))
      .toBeInTheDocument()
    expect(prepare).toHaveBeenCalledWith(data(), TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root)
    expect(
      screen.getAllByRole('button', { name: /Download/u }),
    ).toHaveLength(7)
    expect(screen.getAllByText('a'.repeat(64)).length).toBeGreaterThan(0)
    expect(screen.getByText(/full target at all supported resolutions/u))
      .toBeInTheDocument()
  })

  it('renders a fail-closed preparation error', async () => {
    const prepare = vi
      .fn<GeographicImpactExportPreparer>()
      .mockRejectedValue(new Error('checksum differs'))
    render(
      <GeographicImpactExport
        data={data()}
        scope={TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root}
        prepare={prepare}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepare geographic export' }))
    await waitFor(() => expect(screen.getByText('checksum differs')).toBeInTheDocument())
    expect(screen.getByText('Geographic export stopped')).toBeInTheDocument()
  })
})

function bundle(): GeographicImpactExportBundle {
  const roles = [
    'cells_json',
    'cells_csv',
    'source_cells_parquet',
    'scope_summary_json',
    'scope_summary_csv',
    'methodology_json',
    'manifest_json',
  ] as const
  return {
    schemaVersion: 'taxalens-geographic-impact-export:v1.0.0',
    prefix: 'taxalens-test',
    files: roles.map((role) => ({
      role,
      filename: `${role}.test`,
      mediaType: 'application/octet-stream',
      bytes: new Uint8Array([1]),
      sha256: 'a'.repeat(64),
    })),
    bundleSha256: 'a'.repeat(64),
    manifestSignatureStatus: 'unavailable',
    scientificClaimAllowed: false,
  }
}

function data(): PublicGeographicImpactMapData {
  return {
    cells: [],
    spatialResolution: 3,
    scopeId: 'global',
    source: PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
    scientificClaimAllowed: false,
  }
}
