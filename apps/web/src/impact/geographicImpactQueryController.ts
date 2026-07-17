import type { TaxaLensProjectFacade } from '../data/projectFacade'
import {
  queryGeographicImpact,
  type GeographicImpactBrowserResult,
} from './geographicImpactAnalytics'

export type GeographicImpactQueryExecutor = (
  project: TaxaLensProjectFacade,
  candidate: unknown,
  signal: AbortSignal,
) => Promise<GeographicImpactBrowserResult>

/** Own exactly one latest interactive query and cancel it on replacement/disposal. */
export class GeographicImpactQueryController {
  readonly #execute: GeographicImpactQueryExecutor
  #active: AbortController | null = null
  #disposed = false

  constructor(execute: GeographicImpactQueryExecutor = queryGeographicImpact) {
    this.#execute = execute
  }

  async run(
    project: TaxaLensProjectFacade,
    candidate: unknown,
  ): Promise<GeographicImpactBrowserResult> {
    if (this.#disposed) {
      throw new Error('Geographic Impact query controller is disposed.')
    }
    this.cancel()
    const controller = new AbortController()
    this.#active = controller
    try {
      const result = await this.#execute(project, candidate, controller.signal)
      if (controller.signal.aborted || this.#active !== controller) {
        throw new DOMException('Geographic Impact query was superseded.', 'AbortError')
      }
      return result
    } finally {
      if (this.#active === controller) {
        this.#active = null
      }
    }
  }

  cancel(): void {
    this.#active?.abort()
    this.#active = null
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.cancel()
  }

  get active(): boolean {
    return this.#active !== null
  }
}
