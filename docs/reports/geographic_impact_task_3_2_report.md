# Geographic Impact Task 3.2 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `7246cce22b5154df7c330e09d0e79393d8780caf`
- TaxaLens subtask push SHA: `cd5cee8a8439454dee01e11c655134899551bd54`
- Verified remote `origin/main`: `cd5cee8a8439454dee01e11c655134899551bd54`
- BioMiner baseline evidence origin:
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin:
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` at the task gate:
  `725e77539da279332d4c8fd256a99eee44de545e`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `gpt-5.6-sol`
- Reasoning effort: `xhigh`

BioMiner advanced independently during the geographic implementation. No moving
BioMiner `main` content was consumed. The browser source contract remains bound
to the exact baseline and Flickr artifact revisions above and to the checksums in
the committed Geographic Impact manifest.

## Typed query boundary

Every browser query now requires:

- project ID;
- run ID;
- accepted taxon key;
- baseline snapshot ID;
- Flickr snapshot ID;
- a manifest-declared spatial resolution;
- one global, continent, country, or admin1 scope node;
- one closed evidence-maturity mode;
- one closed display/ranking metric.

The validator rejects missing, whitespace-padded, unknown, or ambiguous values
before DuckDB-Wasm starts. H3-compatible resolution values are validated at the
type boundary and then checked against the selected manifest, so the product does
not hard-code this replay's 3/5/7 configuration.

## Verified source registration

The source loader resolves artifacts by verified section role and schema rather
than by pilot artifact ID. It binds every descriptor back to the Geographic
Impact manifest using schema, media type, checksum, byte count, record count,
source repository, and source commit. It registers four deterministic in-memory
Parquet files:

1. canonical baseline occurrence union, or a declared compatible spread fallback;
2. precision-aware Flickr geography with consensus projection;
3. materialized Geographic Impact cells carrying quality and release bindings;
4. materialized Geographic Impact summaries.

The country hierarchy remains bounded verified JSON. Consensus, quality-snapshot,
and release-decision availability remains explicit from the manifest. In the
current evidence, consensus and the empty release-decision artifact are available,
while the quality snapshot is unavailable because no retained human outcomes
support one. The loader does not invent an empty quality table.

## Browser full-outer comparison

DuckDB-Wasm independently aggregates baseline and Flickr source rows at the
selected resolution, then executes a real `FULL OUTER JOIN`. The equality keys are:

1. `project_id`;
2. `run_id`;
3. `accepted_taxon_key`;
4. `baseline_snapshot_id`;
5. `flickr_snapshot_id`;
6. `spatial_resolution`;
7. `spatial_cell_id`.

The baseline union counts distinct canonical observations and uses
range-inference-eligible observations for cell-presence semantics. The Flickr
side counts distinct photos only where the precision contract supports the
selected cell. Reviewed target-positive, reviewed non-target, uncertain,
pending, media-failure, and deferred states use the upstream projection's closed
vocabulary. Skip/deferred and Can't view/media failure cannot support an
additional cell.

The independently joined source result is full-outer joined to the materialized
cell artifact. Source presence, materialized presence, every count, and every
cell-state flag must reconcile. Release-ready counts come only from the
materialized occurrence-release decision path; the browser never derives release
readiness from consensus alone.

## Rollups

The second query in the same worker session returns exactly one selected rollup
and its immediate child level:

- global → continents;
- continent → countries;
- country → admin1;
- admin1 → no children.

All reads retain the five evidence identities and selected resolution. Child
ranking uses a closed metric-to-column mapping. Direct iNaturalist delta remains
unavailable/null when no direct snapshot exists. In full comparison mode, 17
selected-summary counts reconcile with the source-joined cell result. A missing
admin1 summary remains unavailable rather than being fabricated.

## Engineering metrics

The query result exposes:

- operation type and seven join keys;
- exact verified input rows per registered relation;
- source-join, reconciliation, and rollup input rows;
- cell and rollup output rows;
- exact registered bytes;
- elapsed worker/registration/query time;
- applied identity, resolution, scope, and evidence-mode filters;
- matched, baseline-only, candidate-only, unclassified, human-supported
  additional, and release-ready additional cell counts;
- fresh-worker/no-persistent-cache state;
- source artifact IDs, checksums, row counts, repositories, and commits.

The committed Parquets are unpartitioned, so filtered partitions are reported as
zero with an explicit unpartitioned state. DuckDB-Wasm does not expose trustworthy
physical Parquet scan bytes through this query path. That metric is therefore
reported as unavailable, with registered bytes labeled only as an upper bound.

## Current public replay boundary

The existing hosted Papilio fixture remains a v1 bundle and continues to migrate
geographic sections to explicit unavailable states. This task implements and
tests the generalized v2 browser analytics path; it does not claim that the
Geographic Impact UI is already wired to the hosted replay. Map rendering,
fixture publication, cancellation, and cache behavior remain later numbered
tasks.

## Commits

- `d513ac9e8a2b2e57680f33a2fe1c9f5804e21dc9` —
  `feat(impact): define browser query input`
- `37c2a70d323f9a4aad8bc5e9b1f91c20bcd53d1e` —
  `feat(impact): register geographic Parquets`
- `10ce062d14629d63ae6cbbb1f3a86a1c29468e0f` —
  `feat(impact): execute browser cell comparison`
- `2c6a7b29cde097b2459a5167258585f310d18d9e` —
  `feat(impact): query geographic rollups`
- `cd5cee8a8439454dee01e11c655134899551bd54` —
  `feat(observatory): expose geographic query metrics`

GitHits records `geo-impact-3.2`, `geo-impact-3.2.1`, `geo-impact-3.2.2`,
`geo-impact-3.2.3`, `geo-impact-3.2.4`, and `geo-impact-3.2.5` are present. The
broad task request returned solution
`3c83acc4-98e8-424b-bc68-f64c1da91a74`, with MIT and Apache-2.0 references.
TaxaLens adopted only the narrow typed-registration/full-outer patterns and
rejected remote bundles, spatial-extension loading, and routine worker
termination. The focused 3.2.1 call timed out after bounded waits; later focused
calls were not repeated and are truthfully recorded unavailable.

## Verification

- Full Python suite: 890 passed.
- Full frontend suite: 388 passed, one skipped; 116 files passed, one skipped.
- TypeScript project check and production build: passed.
- Focused TypeScript geographic query/source/analytics suite: 27 passed.
- Focused Python geographic contract/materialization/DuckDB suite: 50 passed.
- Native DuckDB source/full-outer/rollup check: zero mismatches; 20,237 cells,
  693 baseline-only, 183 matched, and 6,764 candidate-only projection cells.
- Deterministic Geographic Impact rebuild: passed; 20,237 cells and 385 summaries.
- Judge demo bundle verifier: passed.
- Provenance verifier: passed.
- Repository-storage verifier: passed; 6 tables, 4 campaigns, and 82 items.
- BioMiner boundary verifier: passed with moving-`main` and untracked-content
  warnings captured in
  `provenance/biominer_state/biominer_boundary_20260717T131329Z.json`.
- Product browser-query fixed-count audit: no `13_501`, `13,501`, or `13501`
  literal.
- `git diff --check`: passed.

The browser SQL lifecycle is covered with a deterministic DuckDB-Wasm test
double that checks registration, emitted join predicates, decoding,
reconciliation, and cleanup. The independent native DuckDB test reads the real
committed Parquets and verifies the same scientific operation. This report does
not imply that potential candidate-only cells are human-supported or
release-ready evidence.
