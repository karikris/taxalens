import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))
const hierarchy = JSON.parse(
  await readFile(`${repositoryRoot}/demo/source/geography/country_hierarchy.json`, 'utf8'),
)
const canonicalPaths = [
  'README.md',
  'JUDGE_GUIDE.md',
  'submission/PRESENTATION.md',
  'apps/web/scripts/capture-geographic-impact-journey.mjs',
  'apps/web/scripts/verify-hosted-replay.mjs',
  'apps/web/src/agent/fixtures/geographicAnalystStoredReplay.json',
  'apps/web/src/agent/storedGeographicAnalystReplay.ts',
]
const countries = hierarchy.nodes.filter(({ scope_level }) => scope_level === 'country')
const failures = []

for (const relativePath of canonicalPaths) {
  const text = await readFile(`${repositoryRoot}/${relativePath}`, 'utf8')
  for (const country of countries) {
    if (text.includes(country.scope_id)) {
      failures.push(`${relativePath}: hard-coded country scope ${country.scope_id}`)
    }
    const namePattern = new RegExp(`\\b${escapeRegExp(country.scope_name)}\\b`, 'iu')
    if (namePattern.test(text)) {
      failures.push(`${relativePath}: hard-coded country name ${country.scope_name}`)
    }
  }
  if (/\b[0-9a-f]{15}\b/u.test(text)) {
    failures.push(`${relativePath}: hard-coded H3 cell identity`)
  }
  if (/flickr:\d{5,}/u.test(text)) {
    failures.push(`${relativePath}: hard-coded Flickr record identity`)
  }
}

const replay = JSON.parse(
  await readFile(
    `${repositoryRoot}/apps/web/src/agent/fixtures/geographicAnalystStoredReplay.json`,
    'utf8',
  ),
)
const expectedReplayScope = {
  scopeLevel: 'global',
  scopeId: 'global',
  scopeName: 'Global',
  spatialResolution: 3,
}
for (const [key, expected] of Object.entries(expectedReplayScope)) {
  if (replay.scope?.[key] !== expected) {
    failures.push(`stored replay ${key} is ${String(replay.scope?.[key])}; expected ${expected}`)
  }
}

if (failures.length > 0) {
  throw new Error(`Canonical Geographic Impact framing is not global:\n${failures.join('\n')}`)
}

process.stdout.write(
  `Global Geographic Impact framing verified across ${canonicalPaths.length} canonical files.\n`,
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
