# Geographic Impact Lens Task 7.1 Report

## Scope

Task 7.1 adds six deterministic, read-only geographic analyst tools. TaxaLens
started the task at `99f651501cf6ca09785903cd8203e53c7e4f8355` and completed
the numbered subtasks at `96039b0`.

The tools are:

- `inspect_geographic_impact`;
- `compare_geographic_scopes`;
- `list_candidate_gap_cells`;
- `explain_coverage_contribution`;
- `recommend_geographic_review_batch`; and
- `inspect_baseline_provider_union`.

Every call is strict, bounded, marked `read_only: true`, and requires project,
run, accepted taxon, baseline snapshot, Flickr snapshot and spatial resolution.
Closed JSON Schemas reject extra fields, invalid scope levels, unknown metrics
and unbounded record requests.

## Evidence and citations

Each immutable tool evidence packet requires citations for the baseline
provider union, Flickr geography, impact cells, impact summary, country
hierarchy, quality snapshot state, verification campaign and BioMiner source.
Available artifacts require a lowercase SHA-256 digest, source repository,
40-character commit and path. Baseline and Flickr citation snapshot identities
must equal the tool evidence scope.

The committed replay has no retained human outcomes and no retained quality
snapshot. That is represented by an explicit unavailable quality-snapshot
citation and reason; no snapshot is fabricated.

## Deterministic execution

Counts, provider composition, gap-cell ordering and scope comparisons are
projected from the already reconciled DuckDB-Wasm cells and rollups. Stable
cell and item identifiers break ranking ties. The tools do not ask GPT to add
counts, infer novelty or perform a second spatial join.

Review-batch recommendations require explicit committed campaign/item
identities. When no identity satisfies an objective, the tool returns
unavailable with an empty record list. It never creates a review item or writes
review state.

Every result repeats the complete artifact citation chain, sets
`scientificClaimAllowed: false`, and states that Flickr evidence remains
candidate evidence and missing baseline evidence is not biological absence.

## Commits

- `dd3a9b4` — `feat(agent): add geographic impact tools`
- `c9da8d7` — `feat(agent): cite geographic evidence`
- `96039b0` — `feat(agent): ground geographic impact analysis`

GitHits records `geo-impact-7.1` and `geo-impact-7.1.1` through
`geo-impact-7.1.3` are present. The broad result was rejected as generic and
not biodiversity-safe. The 7.1.2 focused request timed out after 120 seconds;
the service was not retried for 7.1.3. No external implementation was copied.

## Verification

- Geographic contract and execution tests: 6 passed across two files.
- Full frontend suite: 521 passed, one skipped; 150 files passed, one skipped.
- Existing agent evaluation suite: 9 passed across three files.
- TypeScript project check: passed.
- Production build, review-asset check, offline-map distribution check and
  public review-media verification: passed.
- Provenance verifier: passed.
- `git diff --check`: passed.

The existing large-chunk build advisory remains non-failing. No live OpenAI
call, external map request, review write or scientific release was performed.

The updated `AGENTS.md` and `docs/agents/` guidance were followed. Those
other-session paths and `submission/AI_CODE_PROVENANCE_REPORT.md` were not
modified or staged.
