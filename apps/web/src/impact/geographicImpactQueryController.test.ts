import { describe, expect, it, vi } from 'vitest'

import {
  createSyntheticGeographicProject,
  syntheticGeographicQuery,
} from '../test/geographicImpactProjectFixture'
import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import { GeographicImpactQueryController } from './geographicImpactQueryController'

const project = createSyntheticGeographicProject()
const result = {
  cells: Object.freeze([]),
  engineering: Object.freeze({
    cacheState: 'fresh_duckdb_worker_memory_no_persistent_cache',
  }),
} as unknown as GeographicImpactBrowserResult

describe('GeographicImpactQueryController', () => {
  it('cancels the preceding query for any replacement input', async () => {
    const requests: Array<{
      readonly candidate: unknown
      readonly signal: AbortSignal
      readonly resolve: (value: GeographicImpactBrowserResult) => void
    }> = []
    const execute = vi.fn(
      async (_project: typeof project, candidate: unknown, signal: AbortSignal) =>
        await new Promise<GeographicImpactBrowserResult>((resolve) => {
          requests.push({ candidate, signal, resolve })
        }),
    )
    const controller = new GeographicImpactQueryController(execute)
    const first = controller.run(project, {
      ...syntheticGeographicQuery,
      geographicScope: { level: 'global', id: 'global' },
    })
    expect(controller.active).toBe(true)

    const second = controller.run(project, syntheticGeographicQuery)

    expect(requests[0]?.signal.aborted).toBe(true)
    expect(requests[1]?.signal.aborted).toBe(false)
    expect(requests.map(({ candidate }) => candidate)).toEqual([
      expect.objectContaining({ geographicScope: { level: 'global', id: 'global' } }),
      expect.objectContaining({ geographicScope: { level: 'country', id: 'country:AU' } }),
    ])
    requests[0]!.resolve(result)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(controller.active).toBe(true)
    requests[1]!.resolve(result)
    await expect(second).resolves.toBe(result)
    expect(controller.active).toBe(false)
  })

  it('cancels on disposal and rejects later execution', async () => {
    let signal: AbortSignal | undefined
    const execute = vi.fn(
      async (_project: typeof project, _candidate: unknown, active: AbortSignal) => {
        signal = active
        return await new Promise<GeographicImpactBrowserResult>(() => undefined)
      },
    )
    const controller = new GeographicImpactQueryController(execute)
    void controller.run(project, syntheticGeographicQuery)

    controller.dispose()

    expect(signal?.aborted).toBe(true)
    expect(controller.active).toBe(false)
    await expect(controller.run(project, syntheticGeographicQuery)).rejects.toThrow(
      'Geographic Impact query controller is disposed',
    )
    controller.dispose()
  })

  it('serves exact repeated inputs from cache without starting another worker', async () => {
    const execute = vi.fn(async () => result)
    const controller = new GeographicImpactQueryController(execute)

    const fresh = await controller.run(project, syntheticGeographicQuery)
    const cached = await controller.run(project, syntheticGeographicQuery)

    expect(fresh.engineering.cacheState).toBe(
      'fresh_duckdb_worker_memory_no_persistent_cache',
    )
    expect(cached.engineering.cacheState).toBe('scoped_memory_cache_hit')
    expect(cached.cells).toBe(fresh.cells)
    expect(execute).toHaveBeenCalledOnce()
    expect(controller.cacheStats()).toMatchObject({ entries: 1, hits: 1, misses: 1 })

    await controller.run(project, { ...syntheticGeographicQuery, metric: 'review_backlog' })
    expect(execute).toHaveBeenCalledTimes(2)
    controller.clearCache()
    expect(controller.cacheStats()).toMatchObject({ entries: 0, cellRows: 0 })
  })
})
