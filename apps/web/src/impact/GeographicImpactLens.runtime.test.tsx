import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.hoisted(() => vi.fn())

vi.mock('./geographicImpactAnalytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./geographicImpactAnalytics')>()),
  queryGeographicImpact: queryMock,
}))

vi.mock('@vis.gl/react-maplibre', () => ({
  Map: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  Popup: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
  ScaleControl: () => null,
}))

import { createSyntheticGeographicProject } from '../test/geographicImpactProjectFixture'
import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import { GeographicImpactLens } from './GeographicImpactLens'

describe('GeographicImpactLens production query ownership', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#dashboard')
    vi.stubGlobal('Worker', class TestWorker {})
    queryMock.mockImplementation(async (_project, input) => ({
      input,
      cells: Object.freeze([]),
      engineering: Object.freeze({
        cacheState: 'fresh_duckdb_worker_memory_no_persistent_cache',
      }),
    } as unknown as GeographicImpactBrowserResult))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('runs the verified project through the full-outer query controller', async () => {
    const project = createSyntheticGeographicProject()

    render(<GeographicImpactLens project={project} webGlSupported={false} />)

    expect(await screen.findByText('Baseline and Flickr evidence mapped')).toBeInTheDocument()
    expect(queryMock).toHaveBeenCalledOnce()
    expect(queryMock.mock.calls[0]?.[0]).toBe(project)
    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      evidenceScope: {
        projectId: 'project:synthetic-geography',
        runId: 'run:synthetic-geography',
      },
      spatialResolution: 3,
      geographicScope: { level: 'global', id: 'global' },
      evidenceMode: 'comparison',
      metric: 'candidate_only_cells',
    })
  })
})
