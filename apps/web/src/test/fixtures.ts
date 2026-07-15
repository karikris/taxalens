export const sectionEntries = Object.fromEntries(
  Array.from({ length: 20 }, (_, index) => [
    `section_${index}`,
    { status: index < 6 ? 'unavailable' : 'available' },
  ]),
)

export const judgeBundleFixture = {
  schema_version: 'taxalens-judge-bundle:v1.0.0',
  bundle_id: 'papilio-demoleus-pilot-75461d9c-v1',
  title: 'Truthful Papilio demoleus metadata pilot',
  target: {
    accepted_taxon_key: 'gbif:1938069',
    scientific_name: 'Papilio demoleus',
    rank: 'species',
  },
  source_revisions: {
    taxalens_sha: '1'.repeat(40),
    biominer_sha: '2'.repeat(40),
  },
  artifact_inventory: [
    {
      artifact_id: 'run-summary',
      path: 'data/run_summary.json',
      role: 'run_summary',
    },
  ],
  sections: sectionEntries,
  rights: {
    status: 'license_checked',
    all_artifacts_covered: true,
  },
  expected_ui_counts: {
    artifact_count: 1,
    unavailable_section_count: 6,
  },
}

export const runSummaryFixture = {
  hero_record_id: 'papilio-demoleus-pilot-awaiting-review',
  hero_state: 'awaiting_human_review',
  scientific_claim_allowed: false,
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
