import type { TaxaLensProjectFacade } from '../data/projectFacade'
import {
  queryGeographicImpact,
  type GeographicImpactBrowserResult,
} from './geographicImpactAnalytics'
import { validateGeographicImpactQueryInput } from './geographicImpactQuery'
import {
  GeographicImpactQueryCache,
  geographicImpactQueryCacheKey,
  type GeographicImpactQueryCacheStats,
} from './geographicImpactQueryCache'

export type GeographicImpactQueryExecutor = (
  project: TaxaLensProjectFacade,
  candidate: unknown,
  signal: AbortSignal,
) => Promise<GeographicImpactBrowserResult>

/** Own exactly one latest interactive query and cancel it on replacement/disposal. */
export class GeographicImpactQueryController {
  readonly #execute: GeographicImpactQueryExecutor
  readonly #cache: GeographicImpactQueryCache
  #active: AbortController | null = null
  #disposed = false

  constructor(
    execute: GeographicImpactQueryExecutor = queryGeographicImpact,
    cache: GeographicImpactQueryCache = new GeographicImpactQueryCache(),
  ) {
    this.#execute = execute
    this.#cache = cache
  }

  async run(
    project: TaxaLensProjectFacade,
    candidate: unknown,
  ): Promise<GeographicImpactBrowserResult> {
    if (this.#disposed) {
      throw new Error('Geographic Impact query controller is disposed.')
    }
    this.cancel()
    const input = validateGeographicImpactQueryInput(candidate)
    const cacheKey = geographicImpactQueryCacheKey(project.manifest.bundle_id, input)
    const cached = this.#cache.get(cacheKey)
    if (cached !== undefined) return cached
    const controller = new AbortController()
    this.#active = controller
    try {
      const result = await this.#execute(project, input, controller.signal)
      if (controller.signal.aborted || this.#active !== controller) {
        throw new DOMException('Geographic Impact query was superseded.', 'AbortError')
      }
      this.#cache.set(cacheKey, result)
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

  cacheStats(): GeographicImpactQueryCacheStats {
    return this.#cache.stats()
  }

  clearCache(): void {
    this.#cache.clear()
  }
}
