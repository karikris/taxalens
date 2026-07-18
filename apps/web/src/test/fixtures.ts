import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import verificationCampaignManifest from '../../../../demo/source/verification/papilio-demoleus-commons.campaign.json'
import {
  JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
  JUDGE_BUNDLE_V1_SCHEMA_VERSION,
} from '../../../../packages/contracts/src/judge_bundle_contract'

const FIXTURE_PREFIX = '../../../../demo/fixture/papilio_pilot/'

const fixtureModules = import.meta.glob<string>(
  '../../../../demo/fixture/papilio_pilot/**/*.json',
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
)

const verificationMediaPaths = verificationCampaignManifest.items.map(
  ({ previewAsset }) => `verification/media/${previewAsset}`,
)
const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/fixture/papilio_pilot',
)

const rawCommittedManifest = fixtureModules[`${FIXTURE_PREFIX}judge_bundle.json`]
if (rawCommittedManifest === undefined) {
  throw new Error('Committed judge bundle JSON fixture is missing')
}
const parsedCommittedManifest = JSON.parse(rawCommittedManifest) as Record<string, unknown>
const artifactInventory = parsedCommittedManifest.artifact_inventory
if (!Array.isArray(artifactInventory)) {
  throw new Error('Committed judge bundle artifact inventory is missing')
}
const binaryArtifactPaths = artifactInventory.flatMap((candidate) => {
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !('path' in candidate) ||
    typeof candidate.path !== 'string' ||
    candidate.path.endsWith('.json')
  ) {
    return []
  }
  return [candidate.path]
})
const binaryFixtureFiles = Object.fromEntries(
  [...new Set([...binaryArtifactPaths, ...verificationMediaPaths])].map((path) => [
    path,
    Uint8Array.from(readFileSync(resolve(fixtureDirectory, path))),
  ]),
)

export const committedFixtureFiles: Readonly<
  Record<string, string | Uint8Array<ArrayBuffer>>
> = Object.freeze({
  ...Object.fromEntries(
    Object.entries(fixtureModules).map(([path, contents]) => [
      path.replace(FIXTURE_PREFIX, ''),
      contents,
    ]),
  ),
  ...binaryFixtureFiles,
})

const committedManifest = committedFixtureFiles['judge_bundle.json']
if (typeof committedManifest !== 'string') {
  throw new Error('Committed judge bundle JSON fixture is missing')
}

export const committedJudgeBundle = JSON.parse(committedManifest) as Record<string, unknown>

/** Project the committed v2 fixture to its evidence-preserving v1 compatibility shape. */
export function committedV1JudgeBundle(): Record<string, unknown> {
  const projected = structuredClone(committedJudgeBundle)
  const sections = projected.sections as Record<string, Record<string, unknown>>
  const expected = projected.expected_ui_counts as Record<string, unknown>
  const sectionRecords = expected.section_records as Record<string, number>
  for (const name of JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES) {
    delete sections[name]
    delete sectionRecords[name]
  }
  for (const name of ['verification_decisions', 'verification_quality'] as const) {
    sections[name] = {
      status: 'unavailable',
      artifact_ids: [],
      reason: 'No retained human review outcome is committed in the v1 fixture.',
      candidate_semantics: 'not_applicable',
      verification_status: 'unavailable',
      human_review_required: true,
      scientific_claim_allowed: false,
    }
  }
  const inventory = projected.artifact_inventory as Record<string, unknown>[]
  projected.artifact_inventory = inventory.filter(
    ({ artifact_id: artifactId }) =>
      typeof artifactId !== 'string' || !artifactId.startsWith('geographic-'),
  )
  projected.schema_version = JUDGE_BUNDLE_V1_SCHEMA_VERSION
  expected.artifact_count = (projected.artifact_inventory as unknown[]).length
  expected.unavailable_section_count = 8
  return projected
}

export function createCommittedFixtureFetcher(
  overrides: Readonly<Record<string, string | Uint8Array<ArrayBuffer>>> = {},
): typeof fetch {
  return async (input) => {
    const url =
      input instanceof Request
        ? new URL(input.url)
        : new URL(input instanceof URL ? input.href : input, window.location.href)
    const path = [...new Set([...Object.keys(committedFixtureFiles), ...Object.keys(overrides)])].find(
      (candidate) => url.pathname === `/${candidate}` || url.pathname.endsWith(`/${candidate}`),
    )
    if (path === undefined) {
      return new Response(null, { status: 404 })
    }
    const body = overrides[path] ?? committedFixtureFiles[path]
    if (body === undefined) {
      return new Response(null, { status: 404 })
    }
    return new Response(body, {
      status: 200,
      headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'application/octet-stream' },
    })
  }
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
