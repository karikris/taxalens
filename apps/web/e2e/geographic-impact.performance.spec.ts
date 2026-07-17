import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))
const impactManifestPath = `${repositoryRoot}/demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json`

interface ImpactArtifactEntry {
  readonly availability: 'available' | 'unavailable'
  readonly logical_name: string
  readonly path: string | null
  readonly media_type: string | null
  readonly byte_size: number | null
}

interface ImpactManifest {
  readonly project_id: string
  readonly run_id: string
  readonly accepted_taxon_key: string
  readonly scientific_name: string
  readonly baseline_snapshot_id: string
  readonly flickr_snapshot_id: string
  readonly artifacts: readonly ImpactArtifactEntry[]
}

interface GeographicPerformanceMeasurement {
  readonly environment: {
    readonly userAgent: string
    readonly online: boolean
    readonly externalRequestCount: number
  }
  readonly artifactLoad: {
    readonly milliseconds: number
    readonly fileCount: number
    readonly bytes: number
  }
  readonly firstQuery: {
    readonly milliseconds: number
    readonly cellCount: number
    readonly baselineUnionCount: number | null
    readonly flickrCandidateCount: number
    readonly candidateOnlyCellCount: number
    readonly registeredBytes: number
    readonly cacheState: string
  }
  readonly cachedQuery: {
    readonly milliseconds: number
    readonly cacheState: string
  }
  readonly countryDrilldown: {
    readonly scopeId: string
    readonly milliseconds: number
    readonly cellCount: number
    readonly flickrCandidateCount: number
  }
  readonly mapFeatures: {
    readonly milliseconds: number
    readonly sourceCellCount: number
    readonly emittedFeatureCount: number
    readonly omittedFeatureCount: number
    readonly truncated: boolean
  }
  readonly cache: {
    readonly hits: number
    readonly misses: number
    readonly entries: number
  }
  readonly memory: {
    readonly status: 'available' | 'unavailable'
    readonly usedJsHeapBytesBefore: number | null
    readonly usedJsHeapBytesAfter: number | null
    readonly usedJsHeapDeltaBytes: number | null
  }
}

interface PerformanceSampleSummary {
  readonly samples: readonly number[]
  readonly minimum: number
  readonly median: number
  readonly p95: number
  readonly maximum: number
}

const MAP_STARTUP_SAMPLE_COUNT = 5

const benchmarkLogicalNames = Object.freeze([
  'baseline_geographic_spread',
  'baseline_occurrence_union',
  'flickr_geography',
  'geographic_impact_cells',
  'geographic_impact_summary',
  'country_hierarchy',
] as const)

test('measures the real committed Geographic Impact browser path', async ({ page }) => {
  const manifestBytes = await readFile(impactManifestPath)
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as ImpactManifest
  const pathsByLogicalName = new Map<string, string>([
    ['geographic_impact_manifest', impactManifestPath],
  ])
  for (const logicalName of benchmarkLogicalNames) {
    const entry = manifest.artifacts.find((candidate) => candidate.logical_name === logicalName)
    if (entry?.availability !== 'available' || entry.path === null) {
      throw new Error(`Committed performance artifact is unavailable: ${logicalName}`)
    }
    pathsByLogicalName.set(logicalName, `${repositoryRoot}/${entry.path}`)
  }

  await page.route('**/performance-artifacts/*', async (route) => {
    const logicalName = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').at(-1) ?? '',
    )
    const artifactPath = pathsByLogicalName.get(logicalName)
    if (artifactPath === undefined) {
      await route.abort('failed')
      return
    }
    await route.fulfill({
      path: artifactPath,
      contentType: logicalName.includes('manifest') || logicalName === 'country_hierarchy'
        ? 'application/json'
        : 'application/vnd.apache.parquet',
    })
  })
  await page.route('**/performance-harness.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="en"><title>Geographic Impact performance harness</title><body></body></html>',
    })
  })

  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.goto('/performance-harness.html', { waitUntil: 'domcontentloaded' })

  const measurement = await page.evaluate<GeographicPerformanceMeasurement, undefined>(
    async () => {
      const projectFacadeUrl = '/src/data/projectFacade.ts'
      const queryControllerUrl = '/src/impact/geographicImpactQueryController.ts'
      const featureCollectionUrl = '/src/impact/geographicImpactFeatureCollection.ts'
      const [{ TaxaLensProjectFacade }, { GeographicImpactQueryController }, featureModule] =
        await Promise.all([
          import(/* @vite-ignore */ projectFacadeUrl),
          import(/* @vite-ignore */ queryControllerUrl),
          import(/* @vite-ignore */ featureCollectionUrl),
        ])

      const performanceWithMemory = performance as Performance & {
        readonly memory?: { readonly usedJSHeapSize?: number }
      }
      const heapBefore = performanceWithMemory.memory?.usedJSHeapSize ?? null
      const loadStartedAt = performance.now()
      const manifestResponse = await fetch('/performance-artifacts/geographic_impact_manifest')
      if (!manifestResponse.ok) throw new Error('performance manifest did not load')
      const manifestBuffer = await manifestResponse.arrayBuffer()
      const impactManifest = JSON.parse(new TextDecoder().decode(manifestBuffer))
      const requiredLogicalNames = [
        'baseline_geographic_spread',
        'baseline_occurrence_union',
        'flickr_geography',
        'geographic_impact_cells',
        'geographic_impact_summary',
        'country_hierarchy',
      ]
      const roleByLogicalName: Readonly<Record<string, string>> = {
        baseline_geographic_spread: 'baseline_geographic_spread',
        baseline_occurrence_union: 'baseline_provider_union',
        flickr_geography: 'flickr_geography',
        geographic_impact_cells: 'geographic_impact_cells',
        geographic_impact_summary: 'geographic_impact_summary',
        country_hierarchy: 'country_hierarchy',
      }
      const loadedArtifacts = await Promise.all(
        requiredLogicalNames.map(async (logicalName) => {
          const entry = impactManifest.artifacts.find(
            (candidate: { readonly logical_name: string }) =>
              candidate.logical_name === logicalName,
          )
          if (entry?.availability !== 'available') {
            throw new Error(`performance artifact unavailable: ${logicalName}`)
          }
          const response = await fetch(`/performance-artifacts/${logicalName}`)
          if (!response.ok) throw new Error(`performance artifact did not load: ${logicalName}`)
          const buffer = await response.arrayBuffer()
          if (buffer.byteLength !== entry.byte_size) {
            throw new Error(`performance artifact byte count differs: ${logicalName}`)
          }
          const descriptor = {
            artifact_id: `performance:${logicalName}`,
            path: `performance-artifacts/${logicalName}`,
            media_type: entry.media_type,
            role: roleByLogicalName[logicalName],
            sha256: entry.sha256,
            bytes: entry.byte_size,
            record_count: entry.row_count,
            schema_version: entry.schema_version,
            source_repository: entry.source_repository,
            source_commit: entry.source_commit,
            required: true,
          }
          return {
            logicalName,
            descriptor,
            bytes: new Uint8Array(buffer),
            json:
              logicalName === 'country_hierarchy'
                ? JSON.parse(new TextDecoder().decode(buffer))
                : undefined,
          }
        }),
      )
      const manifestDescriptor = {
        artifact_id: 'performance:geographic_impact_manifest',
        path: 'performance-artifacts/geographic_impact_manifest',
        media_type: 'application/json',
        role: 'geographic_impact_manifest',
        sha256: '0'.repeat(64),
        bytes: manifestBuffer.byteLength,
        record_count: 1,
        schema_version: impactManifest.schema_version,
        source_repository: 'karikris/taxalens',
        source_commit: impactManifest.source_commits.find(
          (source: { readonly repository: string }) =>
            source.repository.toLowerCase() === 'karikris/taxalens',
        ).commit_sha,
        required: true,
      }
      const availableSection = (artifactId: string) => ({
        status: 'available',
        artifact_ids: [artifactId],
        reason: null,
        candidate_semantics: 'hypothesis_not_occurrence',
        verification_status: 'machine_verified_contract',
        human_review_required: true,
        scientific_claim_allowed: false,
      })
      const sections = Object.fromEntries(
        loadedArtifacts.map(({ descriptor }) => [
          descriptor.role,
          availableSection(descriptor.artifact_id),
        ]),
      )
      const artifacts = new Map(
        loadedArtifacts.map(({ descriptor, bytes, json }) => [
          descriptor.artifact_id,
          Object.freeze({ descriptor: Object.freeze(descriptor), bytes, json }),
        ]),
      )
      artifacts.set(
        manifestDescriptor.artifact_id,
        Object.freeze({
          descriptor: Object.freeze(manifestDescriptor),
          bytes: new Uint8Array(manifestBuffer),
          json: impactManifest,
        }),
      )
      const bundleManifest = {
        schema_version: 'taxalens-judge-bundle:v2.0.0',
        bundle_id: `performance:${impactManifest.manifest_id}`,
        target: {
          accepted_taxon_key: impactManifest.accepted_taxon_key,
          scientific_name: impactManifest.scientific_name,
          rank: 'species',
        },
        sections,
        artifact_inventory: [...loadedArtifacts.map(({ descriptor }) => descriptor), manifestDescriptor],
      }
      const project = new TaxaLensProjectFacade(
        {
          manifest: bundleManifest,
          receipt: {
            sourceSchemaVersion: 'taxalens-judge-bundle:v2.0.0',
            targetSchemaVersion: 'taxalens-judge-bundle:v2.0.0',
            applied: false,
            storedFilesRewritten: false,
            addedSections: [],
            preservedV1FingerprintSha256: null,
          },
        },
        artifacts,
      )
      const artifactLoadMilliseconds = performance.now() - loadStartedAt
      const artifactLoadBytes = loadedArtifacts.reduce(
        (total, artifact) => total + artifact.bytes.byteLength,
        manifestBuffer.byteLength,
      )

      const evidenceScope = {
        projectId: impactManifest.project_id,
        runId: impactManifest.run_id,
        targetAcceptedTaxonKey: impactManifest.accepted_taxon_key,
        baselineSnapshotId: impactManifest.baseline_snapshot_id,
        flickrSnapshotId: impactManifest.flickr_snapshot_id,
      }
      const globalQuery = {
        evidenceScope,
        spatialResolution: 3,
        geographicScope: { level: 'global', id: 'global' },
        evidenceMode: 'comparison',
        metric: 'record_count',
      }
      const controller = new GeographicImpactQueryController()
      const firstQueryStartedAt = performance.now()
      const globalResult = await controller.run(project, globalQuery)
      const firstQueryMilliseconds = performance.now() - firstQueryStartedAt

      const cachedQueryStartedAt = performance.now()
      const cachedResult = await controller.run(project, globalQuery)
      const cachedQueryMilliseconds = performance.now() - cachedQueryStartedAt

      const countryQuery = {
        ...globalQuery,
        geographicScope: { level: 'country', id: 'country:IN' },
      }
      const drilldownStartedAt = performance.now()
      const countryResult = await controller.run(project, countryQuery)
      const countryDrilldownMilliseconds = performance.now() - drilldownStartedAt

      const featureStartedAt = performance.now()
      const features = featureModule.buildBoundedGeographicImpactFeatures(
        globalResult.cells,
        'record_count',
      )
      const featureMilliseconds = performance.now() - featureStartedAt
      const cache = controller.cacheStats()
      controller.dispose()
      const heapAfter = performanceWithMemory.memory?.usedJSHeapSize ?? null

      return {
        environment: {
          userAgent: navigator.userAgent,
          online: navigator.onLine,
          externalRequestCount: 0,
        },
        artifactLoad: {
          milliseconds: artifactLoadMilliseconds,
          fileCount: loadedArtifacts.length + 1,
          bytes: artifactLoadBytes,
        },
        firstQuery: {
          milliseconds: firstQueryMilliseconds,
          cellCount: globalResult.cells.length,
          baselineUnionCount: globalResult.selectedRollup.baselineUnionCount,
          flickrCandidateCount: globalResult.selectedRollup.flickrCandidateCount,
          candidateOnlyCellCount: globalResult.candidateOnlyCellCount,
          registeredBytes: globalResult.engineering.registeredBytes,
          cacheState: globalResult.engineering.cacheState,
        },
        cachedQuery: {
          milliseconds: cachedQueryMilliseconds,
          cacheState: cachedResult.engineering.cacheState,
        },
        countryDrilldown: {
          scopeId: countryResult.selectedRollup.scopeId,
          milliseconds: countryDrilldownMilliseconds,
          cellCount: countryResult.cells.length,
          flickrCandidateCount: countryResult.selectedRollup.flickrCandidateCount,
        },
        mapFeatures: {
          milliseconds: featureMilliseconds,
          sourceCellCount: features.sourceCellCount,
          emittedFeatureCount: features.emittedFeatureCount,
          omittedFeatureCount: features.omittedFeatureCount,
          truncated: features.truncated,
        },
        cache: {
          hits: cache.hits,
          misses: cache.misses,
          entries: cache.entries,
        },
        memory: {
          status: heapBefore === null || heapAfter === null ? 'unavailable' : 'available',
          usedJsHeapBytesBefore: heapBefore,
          usedJsHeapBytesAfter: heapAfter,
          usedJsHeapDeltaBytes:
            heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore,
        },
      }
    },
    undefined,
  )

  const externalRequests = requestUrls.filter((url) => {
    const parsed = new URL(url)
    return parsed.origin !== 'http://127.0.0.1:4173'
  })
  const reportedMeasurement: GeographicPerformanceMeasurement = {
    ...measurement,
    environment: {
      ...measurement.environment,
      externalRequestCount: externalRequests.length,
    },
  }

  expect(reportedMeasurement.environment.online).toBe(true)
  expect(externalRequests).toEqual([])
  expect(reportedMeasurement.artifactLoad.fileCount).toBe(7)
  expect(reportedMeasurement.artifactLoad.bytes).toBe(5_506_400)
  expect(reportedMeasurement.firstQuery.cellCount).toBe(2_155)
  expect(reportedMeasurement.firstQuery.baselineUnionCount).toBe(19_201)
  expect(reportedMeasurement.firstQuery.flickrCandidateCount).toBe(13_416)
  expect(reportedMeasurement.firstQuery.candidateOnlyCellCount).toBe(1_221)
  expect(reportedMeasurement.firstQuery.registeredBytes).toBe(4_883_017)
  expect(reportedMeasurement.firstQuery.cacheState).toBe(
    'fresh_duckdb_worker_memory_no_persistent_cache',
  )
  expect(reportedMeasurement.cachedQuery.cacheState).toBe('scoped_memory_cache_hit')
  expect(reportedMeasurement.countryDrilldown.scopeId).toBe('country:IN')
  expect(reportedMeasurement.countryDrilldown.cellCount).toBe(208)
  expect(reportedMeasurement.countryDrilldown.flickrCandidateCount).toBe(568)
  expect(reportedMeasurement.mapFeatures.sourceCellCount).toBe(2_155)
  expect(reportedMeasurement.mapFeatures.emittedFeatureCount).toBe(2_155)
  expect(reportedMeasurement.mapFeatures.omittedFeatureCount).toBe(0)
  expect(reportedMeasurement.mapFeatures.truncated).toBe(false)
  expect(reportedMeasurement.cache).toEqual({ hits: 1, misses: 2, entries: 2 })
  expect(reportedMeasurement.artifactLoad.milliseconds).toBeGreaterThanOrEqual(0)
  expect(reportedMeasurement.firstQuery.milliseconds).toBeGreaterThan(0)
  expect(reportedMeasurement.cachedQuery.milliseconds).toBeGreaterThanOrEqual(0)
  expect(reportedMeasurement.countryDrilldown.milliseconds).toBeGreaterThan(0)
  expect(reportedMeasurement.mapFeatures.milliseconds).toBeGreaterThanOrEqual(0)

  console.log(`GEOGRAPHIC_IMPACT_PERFORMANCE ${JSON.stringify(reportedMeasurement)}`)
})

test('measures repeated application map initialization', async ({ browser }) => {
  test.setTimeout(120_000)
  const samples: number[] = []
  const featureCounts: number[] = []

  for (let sample = 0; sample < MAP_STARTUP_SAMPLE_COUNT; sample += 1) {
    const context = await browser.newContext({
      colorScheme: 'light',
      locale: 'en-AU',
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      ;(window as typeof window & { __taxalensMapInitializationStartedAt?: number })
        .__taxalensMapInitializationStartedAt = performance.now()
    })
    try {
      await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' })
      const canvas = page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
      await expect(canvas).toHaveAttribute('data-camera-scope', 'global', {
        timeout: 60_000,
      })
      await expect(canvas).toHaveAttribute('data-baseline-evidence', 'true')
      await expect(canvas).toHaveAttribute('data-flickr-evidence', 'true')

      const elapsedMilliseconds = await page.evaluate(() => {
        const startedAt = (
          window as typeof window & { __taxalensMapInitializationStartedAt?: number }
        ).__taxalensMapInitializationStartedAt
        if (startedAt === undefined) {
          throw new Error('Geographic Impact map initialization timer was not installed')
        }
        return performance.now() - startedAt
      })
      const featureCount = Number(await canvas.getAttribute('data-impact-feature-count'))
      samples.push(elapsedMilliseconds)
      featureCounts.push(featureCount)
    } finally {
      await context.close()
    }
  }

  expect(featureCounts).toEqual(Array(MAP_STARTUP_SAMPLE_COUNT).fill(2_155))
  const measurement = {
    sampleCount: MAP_STARTUP_SAMPLE_COUNT,
    featureCount: featureCounts[0],
    milliseconds: summarizePerformanceSamples(samples),
  }
  console.log(`GEOGRAPHIC_IMPACT_MAP_INITIALIZATION ${JSON.stringify(measurement)}`)
})

function summarizePerformanceSamples(samples: readonly number[]): PerformanceSampleSummary {
  if (samples.length === 0) throw new Error('Performance samples must not be empty')
  const sorted = [...samples].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1]! + sorted[middle]!) / 2
      : sorted[middle]!
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return Object.freeze({
    samples: Object.freeze(samples.map(roundMilliseconds)),
    minimum: roundMilliseconds(sorted[0]!),
    median: roundMilliseconds(median),
    p95: roundMilliseconds(sorted[p95Index]!),
    maximum: roundMilliseconds(sorted.at(-1)!),
  })
}

function roundMilliseconds(value: number): number {
  return Number(value.toFixed(2))
}
