# Phase 7 report — first butterfly dashboard

## Outcome

Phase 7 turns the checksum-verified *Papilio demoleus* replay into an operational Butterfly
Dashboard. Judges can inspect the acquisition funnel, map candidate workload, audit review priority,
measure query yield, distinguish observed work from unavailable efficiency savings, see the current
scientific evaluation block, and download five deterministic research outputs.

The dashboard is not a photo wall. It is a local research-operations view over 22 verified
artifacts and four on-demand Parquets. It makes unavailable states and unlike units visible, carries
artifact provenance into each analysis, and never promotes a Flickr candidate, source-media
candidate, or geographic cluster into an occurrence or reviewed species decision.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Starting SHA after Phase 6 reporting:
  `d71318969d59884daced3c2ceb417572b400c665`
- Task 7.1: `ae4f7b09264dd200e31b686f476e6d3632d06db4` — add evidence funnel
- Task 7.2: `a2baa25b21f5b435bea7ae5d844ab9909b22a905` — map candidate workload
- Task 7.3: `1ba7fc7848647262c248f44c6f51fef310e0cbcb` — prioritize review work
- Task 7.4: `99f07d39140883e5ff0a857eeae5dce07c17ce58` — measure discovery yield
- Task 7.5: `49ffd2ac309a52cef7724ae8ebac72d15fd8feb5` — report workflow efficiency
- Task 7.6: `da172eb21299bbe9a48e6aab5af296392a0063c5` — show reviewed evaluation state
- Task 7.7 and pushed Phase 7 task SHA:
  `205cb1a47d20fa5fa2de35ac0d33af49599d7cd9` — export research outputs

At the Phase 7 task gate, local `HEAD` and `origin/main` both resolved to
`205cb1a47d20fa5fa2de35ac0d33af49599d7cd9`.

## Evidence funnel

The funnel presents seven workflow states in sequence while explicitly refusing to calculate
conversion rates across unlike units:

1. 76,485 many-to-many Flickr query-hit associations;
2. 13,501 canonical source-photo records;
3. unavailable unique-content groups because duplicate relationship rows are absent;
4. zero YOLOE-processed images at the metadata-only route boundary;
5. six scoreable taxon identities: one target and five regional competitor hypotheses;
6. zero calibrated decision outputs;
7. one awaiting-review replay record without a materialized queue.

Each stage names its measurement basis and one or more verified artifact receipts. No funnel width,
percentage, or visual area implies a scientific retention rate.

## Geographic workload

An explicit action starts DuckDB-Wasm and maps 76 candidate cluster centroids from the verified
geography and assignment Parquets. The view measures zero no-geo canonical rows, 792 unassigned
geotagged records, 707 outlier assignments, a 247-item source-candidate shortfall, and a 490-item
human-review shortfall.

Every cluster can be selected by keyboard and inspected in a complete 76-row table. Cluster radius
is labelled as a workload-spread diagnostic rather than uncertainty. H3 output and review density
remain unavailable because neither an H3 artifact nor a materialized review-record-to-cluster join
is committed. Candidate marks never use occurrence language.

## Review work priority

The one committed awaiting-review record appears as position 1 of 1, not as a score-derived rank.
Its priority score remains unavailable because no materialized queue or peers exist. All five
selective-decision gates are blocked.

The dashboard audits the seven requested factors separately:

- competitor margin is unavailable without target and competitor scores;
- missing calibration is an evidence blocker, not a numeric contribution;
- reference shortfall is aggregate-only and not joined to the record;
- visual disagreement and small-subject status are unavailable without visual outputs;
- zero committed comments provide no comment-conflict signal;
- geographic anomaly is unlinked without a verified record-to-assignment key.

Every factor records `priorityEffect: not-scored`, preserving review attention without fabricating a
priority model.

## Query-yield analysis

The query-yield action runs exact SQL over the checksum-verified BioMiner query-hit Parquet. Only
direct tier prefixes are assigned to taxonomic slices:

| Direct tier | Hit associations | Unique source photos |
| --- | ---: | ---: |
| family | 16,636 | 5,658 |
| genus | 41,243 | 6,773 |
| species scientific name | 3,458 | 1,063 |

Kingdom, phylum, class, and order remain unavailable because the committed workload contains no
direct tiers for them. Contextual searches remain in a separate unassigned bucket: 15,148 hit
associations, 3,681 unique source photos, 145 represented terms, 304 represented query hashes, and
seven term classes.

Unique-photo counts overlap and are explicitly non-additive. Distinct query hashes are not called
physical requests, search terms are not promoted to authoritative logical queries, and marginal API
cost remains unavailable without a request and cost ledger. Adult routes and final evidence counts
are verified global zeros, not rank-attributed yields.

## Workflow efficiency

The requested efficiency panel separates observed execution diagnostics from counterfactual saved
work. Five savings claims remain unavailable:

- API calls avoided;
- duplicate downloads avoided;
- repeated inference avoided;
- embedding reuse;
- restart efficiency.

The committed evidence records 314 executed requests, zero retries, zero rate limits, 22 of 22
complete checkpoints, four observation-row deduplications, five media-candidate-row deduplications,
and zero downloaded or inference-processed images. None is relabelled as avoided work or speedup.

Evidence completeness is the one measured state ledger: 22 of 22 artifacts passed checksum
verification, while the 20 content sections remain five available, nine partial, and six
unavailable. That inventory is not a scientific accuracy, readiness, or completeness percentage.

## Reviewed evaluation state

The judge bundle supplies no Phase 13 result artifact, so it supplies zero valid committed reviewed
Phase 13 metrics. Phase 13 adapter tests and synthetic fixtures remain compatibility evidence and
are not displayed as pilot results.

Phase 14 is blocked before evaluation. The dashboard reports zero human-verified source media, a
490-item human-review shortfall, one group awaiting human review, two unresolved groups, zero visual
scores, and zero calibrated decisions. Precision, recall, PR-AUC, accuracy, calibration, and
selective coverage each appear as unavailable with their required denominator or artifact. No empty
chart, probability, precision, or accuracy value is drawn.

## Deterministic research outputs

An explicit local action prepares five canonical JSON downloads:

- an unranked review-queue snapshot with one item and the seven-factor audit;
- an evidence summary containing the verified bundle state, section ledger, counts, and funnel;
- a checksum manifest for the other four payloads;
- provenance for all 22 artifact receipts and both pinned source revisions;
- the blocked evaluation report with all unavailable metric states preserved.

Stable filenames derive from the target and review state. Every offered file receives a SHA-256
digest over its exact bytes. The manifest has no recursive self-entry, although the UI hashes the
downloaded manifest separately. It remains unsigned because no signing key or identity is committed.
No preparation timestamp is added, repeated preparation is byte-stable, and generation performs no
external request.

## Product and performance boundary

The dashboard workspace is lazy-loaded after navigation rather than added to the initial shell
bundle. The verified Phase 7 build produced a 461.34 kB main JavaScript chunk and a separate
59.97 kB dashboard chunk, with no Vite size warning. DuckDB-Wasm, its worker, and Parquet extension
remain separate lazy assets and start only after an analysis action.

All views include textual or tabular alternatives, keyboard-operable controls, reduced-motion-safe
styling, local-only request assertions, and mobile overflow checks. Desktop and 390×844 inspections
covered the workload map, review factors, query yield, efficiency, evaluation, and prepared export
states.

## Phase gates

The final Phase 7 gate passed:

- `uv sync --locked`;
- `uv run pytest` — 627 passed;
- `npm audit --audit-level=high` — zero vulnerabilities;
- strict TypeScript project check;
- Vitest — 81 passed across 41 files;
- production Vite build and byte-exact static fixture verification;
- Chromium Playwright — 20 flows, including all seven dashboard panels, parsed JSON downloads,
  local-only requests, keyboard interaction, reduced motion, and mobile overflow;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification at the pinned SHA with per-task state snapshots;
- GitHits JSONL validation and `git diff --check`;
- desktop and 390×844 visual inspection.

The repository-wide Ruff audit continues to report 209 pre-existing findings in mechanically
preserved BioMiner modules and tests. Phase 7 did not sweep those provenance-sensitive files.

## BioMiner boundary decision

BioMiner remained on `main` at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Phase 7 consumed its already imported,
checksum-verified metadata and four Parquets. It copied no engine runtime and modified no BioMiner
file. The pre-existing untracked BioMiner configuration, documentation, query-term, and log paths
remained untouched and outside the evidence boundary.

## Accepted limitations and Phase 8 handoff

- No rights-cleared image, route output, transformed frame, embedding, visual score, calibrator,
  reviewed label, or final scientific evidence record is committed.
- The map and query-yield slices describe acquisition candidates and workload, not occurrences.
- No ranked review queue exists; the single work item is an unscored operational snapshot.
- Five workflow-savings categories remain uninstrumented.
- Phase 13 results and Phase 14 performance metrics remain unavailable.
- Both export manifests remain checksum-bearing but unsigned.

Phase 8 can add an OpenAI research-analyst foundation only after current official documentation and
the required model surface are verified. The credential-free replay must remain the default judge
path, deterministic tools must return the same evidence-bound data as the UI, and all model-generated
explanations must be separated from committed scientific evidence.
