import { describe, expect, it, vi } from 'vitest'

import type { TaxaLensProjectFacade } from '../data/projectFacade'
import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import { GeographicImpactQueryController } from './geographicImpactQueryController'

const project = {} as TaxaLensProjectFacade
const result = {} as GeographicImpactBrowserResult

describe('GeographicImpactQueryController', () => {
  it('cancels the preceding query for any replacement input', async () => {
    const requests: Array<{
      readonly candidate: unknown
      readonly signal: AbortSignal
      readonly resolve: (value: GeographicImpactBrowserResult) => void
    }> = []
    const execute = vi.fn(
      async (_project: TaxaLensProjectFacade, candidate: unknown, signal: AbortSignal) =>
        await new Promise<GeographicImpactBrowserResult>((resolve) => {
          requests.push({ candidate, signal, resolve })
        }),
    )
    const controller = new GeographicImpactQueryController(execute)
    const first = controller.run(project, { scope: 'global' })
    expect(controller.active).toBe(true)

    const second = controller.run(project, { scope: 'country:AU' })

    expect(requests[0]?.signal.aborted).toBe(true)
    expect(requests[1]?.signal.aborted).toBe(false)
    expect(requests.map(({ candidate }) => candidate)).toEqual([
      { scope: 'global' },
      { scope: 'country:AU' },
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
      async (_project: TaxaLensProjectFacade, _candidate: unknown, active: AbortSignal) => {
        signal = active
        return await new Promise<GeographicImpactBrowserResult>(() => undefined)
      },
    )
    const controller = new GeographicImpactQueryController(execute)
    void controller.run(project, { metric: 'record_count' })

    controller.dispose()

    expect(signal?.aborted).toBe(true)
    expect(controller.active).toBe(false)
    await expect(controller.run(project, {})).rejects.toThrow(
      'Geographic Impact query controller is disposed',
    )
    controller.dispose()
  })
})
