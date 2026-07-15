# Phase 6 report — truthful evidence lens

## Outcome

Phase 6 makes one real *Papilio demoleus* replay record inspectable from discovery metadata through
local audit export. Evidence Lens traces the deterministic most-associated Flickr source candidate
across four checksum-verified BioMiner Parquets, retains all 181 query associations, and shows its
exact candidate coordinate and cluster context without promoting either to an occurrence.

The interface also establishes complete contracts for YOLOE routing, full-frame visual inputs,
candidate comparison, calibration, selective decision, review history, and export. Where the pilot
contains no produced artifact, it shows the field and its reason as unavailable. It does not invent
an image, mask, transformation, score, probability, comment, signature, or scientific conclusion.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Starting SHA after Phase 5 reporting:
  `a3875804054212838288b5bb02ef9916cb12ee6a`
- Task 6.1: `9445fb5b3aeaa4eb9e9c8408b7f6f038e663cced` — show discovery provenance
- Task 6.2: `02329d69d721ba9bdbd8878ba4095f1c637ed2a8` — visualize YOLOE routing
- Task 6.3: `6d0c240181bcfde042ec8137266224cdf7c66dc0` — compare full-frame inputs
- Task 6.4: `9da68e9373fca93dd813c675aba35c7b4fe6e45d` — compare candidate species
- Task 6.5: `ec9daae497617e24131bfc681d6f4ca312e6f707` — explain the selective decision
- Task 6.6: `27d49f60dacc477bf97a59e5c0f07e462eadab39` — show geography and reference context
- Task 6.7: `9543961e11c4b69b8dccad567c3b4b4743c6abb4` — add the evidence ledger
- Task 6.8 and pushed Phase 6 task SHA:
  `a6346bb406dff7327565bfe7f6eb16bb056cd60d` — export the audit bundle

At the Phase 6 task gate, local `HEAD` and `origin/main` both resolved to
`a6346bb406dff7327565bfe7f6eb16bb056cd60d`.

## Inspectable discovery provenance

The discovery action remains lazy. Only an explicit user action starts DuckDB-Wasm and joins the
verified query-hit, geography, geographic-assignment, and cluster Parquets. Selection is
deterministic: association count descending, then source identity and photo ID.

The selected record is Flickr photo `55081300254`, source ID `flickr:55081300254`, with canonical
source hash
`sha256:ddce85e192e3fe8548a75681f0dff6b6f0d00bb818eca891521faa0197274e40`.
The interface exposes all 181 many-to-many query associations, including query hash, query-term
rank, keyword, trust tier, and search field. The canonical source hash remains distinct from an
unavailable duplicate-group identity.

The fixture contains no rights-cleared source image. Creator, image licence, image attribution,
licensed thumbnail, and duplicate relationships therefore remain explicitly unavailable.

## Visual-routing and full-frame contracts

The YOLOE panel names the original image, detection box, and segmentation mask as separate visual
layers. It also exposes route, visual domain, life stage, subject area, multi-organism assessment,
and route reason. All remain unavailable because the verified pilot contains zero YOLOE images and
no detection artifact. A textual alternative carries the same state, and the interface states that
YOLOE routes evidence rather than identifying species.

The full-frame viewer provides keyboard-operable raw, focused, masked, and multi-object modes. It
keeps full-canvas retention, transformation version, transformation fingerprint, and embedding
identity separate. No crossfade, pixel pair, transform identity, or embedding identity is created
because the fixture contains zero transformed frames.

## Candidate and selective-decision boundary

The candidate comparison shows the target and all six verified planning candidates. Four planning
alternatives are inspectable with their exact candidate reasons, but they are not called the four
strongest because the pilot contains zero visual scores. Plan order is not relabelled as score rank.

Target rank, best regional competitor, best non-regional competitor, and best domain negative remain
unavailable. Eligible source-media candidates and human-verified source images are reported as
separate quantities: 838 and zero, respectively.

Seven raw evidence inputs are kept distinct from seven calibrated-decision fields. Raw similarity is
never called probability, null values are not displayed as zero, and no empty probability bar or
threshold scale is drawn. The pilot has no target-aware score artifact, no calibrator output, and a
null selective-decision payload. `awaiting_human_review` remains a workflow state and is not
mislabelled as model abstention.

## Candidate geography and reference status

The selected source candidate carries the exact Flickr search coordinate `59.366308, 18.031366`,
accuracy level 16, and coordinate quality `flickr_street`. It is plotted on a local coordinate plane
without a network basemap. Metric uncertainty remains unavailable; no accuracy-to-metres conversion
or uncertainty radius is invented.

The record joins to cluster `geo:be72642ae1a67685c5a68725` by `coarse_cell`, with 437 candidate
members, seven cells, and a 52.120 km P95 radius. It did not use fallback and is not an outlier. The
cluster remains candidate-distribution metadata, not verified target support or occurrence evidence.

Reference status reports the exact 247 source-candidate shortfall and 490 human-verified shortfall.
MIT rights cover the redistributed BioMiner metadata only; image source and licence remain
unavailable because the fixture includes and licenses zero images.

## Evidence ledger

The ledger represents the required ten states as an evidence lifecycle:

1. discovery;
2. deduplication;
3. geography;
4. reference status;
5. route;
6. visual inputs;
7. candidates;
8. decision;
9. review state;
10. export.

Sequence is not presented as wall-clock chronology. Nine event times are unavailable because their
source artifacts contain no event timestamp. Only the exact judge-bundle creation time is shown at
the committed export boundary. Every event names verified artifact IDs and carries
`scientificClaimAllowed: false`.

The record contains zero comments and zero calibrated decisions. The ledger displays
`comment enrichment unavailable for this record` and does not create a comment-driven promotion.

## Deterministic local export

An explicit browser action prepares five files without a remote request:

- canonical JSON for the record identity and ten-state ledger;
- a CRLF CSV ledger summary with escaped fields;
- the exact verified BioMiner Flickr query-hit Parquet copied byte-for-byte;
- a canonical checksum manifest for the four payload files;
- a canonical provenance report.

Every offered file receives a SHA-256 digest over its exact download bytes. Stable filenames derive
from target and review state. Repeated preparation produces identical bytes and checksums. The
Parquet output retains committed digest
`95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b` and is labelled as the source
query-hit artifact, not a serialization of the ledger.

No signing key is committed. The manifest therefore records signature status as unavailable with
null algorithm, signer, and signature value. Its own UI checksum is computed outside the manifest;
the manifest does not recursively inventory itself. No runtime export timestamp is inserted, so
repeatability is retained.

## Phase gates

The final Phase 6 gate passed:

- `uv sync --locked`;
- `uv run pytest` — 627 passed;
- `npm ci` and `npm audit --audit-level=high` — zero vulnerabilities;
- strict TypeScript project check;
- Vitest — 52 passed across 28 files;
- production Vite build and byte-exact static fixture verifier;
- Chromium Playwright — 13 flows, including lazy four-Parquet discovery inspection, geography,
  unavailable YOLOE and full-frame states, truthful candidates, raw-versus-calibrated evidence, the
  lifecycle ledger, five-file export, a real parsed JSON download, local-only requests, keyboard
  interaction, reduced motion, and mobile overflow;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification at the pinned SHA with an in-repository state snapshot;
- GitHits JSONL validation and `git diff --check`;
- desktop and 390×844 visual inspection of the complete prepared export.

The repository-wide Ruff audit continues to report 209 pre-existing formatting findings in the
mechanically preserved BioMiner source and tests. Phase 6 did not sweep or rewrite those provenance-
sensitive files. No Task 6.8 file was identified by that audit.

## BioMiner boundary decision

BioMiner remained on `main` at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Phase 6 used its pinned contracts to preserve routing,
full-frame, target-aware scoring, calibration, review-history, and Parquet semantics. It copied no
new runtime module and modified no BioMiner file.

The export reuses only the already imported, checksum-verified query-hit Parquet as a byte-preserved
source artifact. BioMiner's pre-existing untracked configuration, documentation, query-term, and log
paths remained untouched and were not treated as evidence.

## Accepted limitations and Phase 7 handoff

- The pilot has no rights-cleared image, detection, mask, transformed frame, embedding, score,
  calibration output, reviewed comment, or final scientific evidence record.
- The selected coordinate and cluster describe candidate acquisition workload, not a confirmed
  species occurrence.
- The candidate list is a planning union. It contains no score-derived rank or strongest competitor.
- The export manifest has checksums but no cryptographic signature because no signing identity or key
  is part of the submitted boundary.
- The preserved Parquet contains discovery query hits, not ledger rows.
- Five workflow-efficiency categories remain uninstrumented and must not become dashboard numbers.

Phase 7 can aggregate these verified counts into operational funnel, workload, review, query-yield,
efficiency, evaluation, and export panels. It must attach provenance to every displayed number,
distinguish unlike units, and keep unavailable scientific and efficiency metrics explicit.
