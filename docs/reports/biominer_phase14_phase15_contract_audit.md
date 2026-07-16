# BioMiner Phase 14 and Phase 15 contract audit

## Outcome

TaxaLens may integrate the committed BioMiner target-aware few-shot prototype at
`67c1c2a3a2c9b909b256b3094913af342f4ccbed`, but only as an explicit
prototype evidence mode. The handoff does not authorize a scientific release,
a production-default change, public display of reference images, calibrated
probabilities, or an accuracy claim.

This is TaxaLens Task 14.1. It pins the upstream boundary before any bytes are
imported or any product state is changed.

## Source boundary

| Item | Audited value |
| --- | --- |
| Repository | `karikris/BioMiner` |
| Branch | `main` |
| Audited and pushed SHA | `67c1c2a3a2c9b909b256b3094913af342f4ccbed` |
| Previous TaxaLens pin | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| Phase 14 report status | `complete_prototype_only` |
| Phase 15 GO gates | 14 required, 14 passed |
| Phase 15 release status | `accepted_prototype_only_with_limitations` |
| Phase 15 final verification | `passed_prototype_only` |

Only committed Git objects at the audited SHA are authoritative. The six
pre-existing untracked BioMiner paths remain outside the TaxaLens boundary and
were not modified or treated as evidence.

## Prototype evidence now available

- A frozen 81-record metadata-qualified support bank: 80 adult-field and one
  larval record, all at trust level R4.
- All 81 rows retain provider, attribution, licence, geographic-layer, route,
  split, and hash identities.
- Frozen 1,024-dimensional BioCLIP embeddings at model revision
  `191d741545e4c741cdef4b22c6eb69c945c1e592`.
- Nineteen B0–B16 experiment rows per reference record and a selected B13
  global-reference policy.
- A selected raw target-versus-competitor margin threshold of `0.10`, with the
  target always scored and higher-rank pruning forbidden.
- Staged inference over 13,501 planned Flickr records: 13,496 classified, five
  retryable failures, 34 species candidates and 47 union candidates scored per
  classified record.
- A separate staged diagnostic abstention state on 12,296 records using a
  `0.02` preselection rule.
- Exact fingerprints for the support bank, model, embeddings, classifier,
  configuration, and selected policy.
- Phase 15 GO, acceptance, final-verification, and post-Build-Week backlog
  artifacts.

## Scientific and rights boundaries

- Independently human-verified reference labels: **0**.
- Provider-supported references: **81**. Provider support is not independent
  taxonomic verification.
- Licence policy: two `allowed`, 79 `research_only`; public reference-image
  display is not authorized.
- Owner evidence is missing for two records, so complete identity-leakage
  protection is not claimed.
- No calibrator is fitted. Raw similarities and margins are not probabilities.
- Accuracy and calibration error are unavailable because no independently
  reviewed labels exist.
- Retrieval consistency, scoreability, action distributions, route
  distributions, and abstention distributions are not classification accuracy,
  biological occurrence, absence evidence, prevalence, or taxonomic
  validation.
- YOLOE is a gate/router only, operates separately from BioCLIP classification,
  and its routing accuracy has not been independently validated.
- BioCLIP uses the raw full image. Focused and masked visual-input ablations were
  unavailable.
- No pinned-specimen prototype, larval `support_train` reference, or frozen
  visual-domain negative exists.

## TaxaLens work items

| Task | Planned product boundary |
| --- | --- |
| 14.1 | Pin and audit the committed Phase 14/15 handoff. |
| 14.2 | Import only compact manifests and reports with exact checksums; exclude media, models, databases, caches, and untracked paths. |
| 14.3 | Add a thin TaxaLens prototype-evidence adapter without copying BioMiner engine code. |
| 14.4 | Rebuild the truthful judge bundle and present prototype reference, scoring, routing, abstention, and limitation evidence through the TaxaLens facade and UI. |
| 15.1 | Add the fail-closed prototype GO/release gate and preserve production/scientific/public-display prohibitions. |
| 15.2 | Extend agent tools, deterministic evaluations, and exports to explain the new prototype boundary with at least 30 cases. |
| 15.3 | Complete Phase 14/15 reports, judge documentation, full acceptance, and deployment verification. |

## GitHits status

GitHits is unavailable in this Codex environment: no service, MCP resource, or
CLI is exposed. The focused attempted query and outage are recorded in
`provenance/githits.jsonl#14.1`. This task therefore relies on the exact
committed BioMiner artifacts, TaxaLens local contracts, and fail-closed
repository policy. No external code was copied.

## Task 14.1 patch plan and verification

- Objective: freeze the exact new upstream identity and integration authority.
- Files: `UPSTREAM_BIOMINER.md`, migration manifest, GitHits ledger, this audit,
  and one generated BioMiner boundary snapshot.
- Contracts: artifact-first integration; explicit prototype mode; no scientific
  claim; no public image display; raw scores are not probabilities.
- Tests: strict BioMiner boundary verification, provenance verification, JSONL
  parse, and `git diff --check`.
- Rights: no media bytes are imported by this task.
- Competition value: lets the existing product consume newly committed real
  prototype evidence without overstating scientific validity.

## Task 14.2 compact artifact import

Task 14.2 uses a fixed 20-path allowlist and reads each payload directly from
the committed BioMiner Git object at the pinned SHA. The importer preserves
exact upstream JSON bytes and verifies the schema version, byte count, and
SHA-256 declared in `demo/source/biominer_phase15/import_manifest.json`.

The imported set contains 15 compact prototype manifests plus the Phase 14
prototype report and four Phase 15 decision/verification reports. It excludes
all source images, reference media bytes, Parquet run payloads, model weights,
databases, caches, Markdown duplicates, and untracked paths. The receipt also
forbids scientific claims and public reference-image display.

GitHits remained unavailable; the focused attempted import-pattern query and
adopted/rejected approaches are recorded at
`provenance/githits.jsonl#14.2`.

## Task 14.3 thin prototype adapter

Task 14.3 adds one TaxaLens-owned anti-corruption layer over the fixed imported
set. It verifies all 20 local artifacts again, then cross-checks repeated facts
across the support-bank, embedding, benchmark, policy, staged-inference, GO,
release-acceptance, final-verification, and backlog contracts.

The adapter exposes nine normalized sections. Every section retains exact
source fingerprints, forbids scientific claims, distinguishes provider support
from human verification, keeps raw scores separate from probabilities, and
keeps the staged `0.02` rule separate from the selected `0.10` policy. No
BioMiner engine code is copied.

GitHits remained unavailable; the focused attempted adapter-pattern query is
recorded at `provenance/githits.jsonl#14.3`.

## Task 14.4 truthful product projection

Task 14.4 rebuilds the public judge fixture around the current reviewed
BioMiner boundary while preserving the exact historical source revision on the
pre-existing pilot metadata and analytics artifacts. The bundle adds one
TaxaLens-produced `prototype-evidence-snapshot` containing the nine normalized
Task 14.3 contracts. It does not import per-record candidate-score rows,
detections, transformations, images, model files, databases, or caches.

The runtime facade verifies the snapshot checksum and rejects contradictory
authorization, count, threshold, score, human-review, rights, or scientific
semantics. Evidence Lens and Dashboard reuse one accessible aggregate panel
showing the 81-row reference bank, BioCLIP and YOLOE runtime identities, B0
versus B13 target scoreability, separate staged `0.02` and selected `0.10`
margin rules, staged execution counts, unavailable accuracy/calibration, and
exact producer provenance.

The existing hero remains `awaiting_human_review`. YOLOE evidence, full-frame
visual-input metadata, target-aware score metadata, comments, candidate
revisions, and evaluation summaries remain explicitly unavailable because the
fixture contains no corresponding per-record evidence. The fixture still
contains no image, and public reference-image display, scientific release, and
production-default changes remain unauthorized.

GitHits remained unavailable; the focused product-projection query and the
adopted/rejected approaches are recorded at
`provenance/githits.jsonl#14.4`.

## Task 15.1 fail-closed release gate

Task 15.1 adds a TaxaLens-owned release evaluator over the normalized prototype
snapshot. It returns `GO_PROTOTYPE_ONLY` only when all fourteen required gates
pass and the caller explicitly requests `explicit_prototype`. Every other
requested mode, missing field, incomplete gate count, contradictory release
decision, broadened authorization, promoted human-review state, probability
claim, accuracy claim, or calibration claim returns a deterministic `NO_GO`
receipt with failed gate IDs, reasons, and evidence paths.

The receipt can authorize prototype integration only. Scientific release,
production-default changes, public reference-image display, and scientific
claims remain false in both GO and NO_GO outcomes. The truthful fixture builder
and committed-fixture verifier now both execute this gate, so a contradictory
Phase 15 snapshot cannot be built or served even when its checksums are
otherwise internally consistent.

GitHits remained unavailable; the focused release-gate query and
adopted/rejected approaches are recorded at
`provenance/githits.jsonl#15.1`.

## Task 15.2 agent, evaluation, and export boundary

Task 15.2 adds three strict read-only tools for the normalized aggregate
prototype evidence: reference/runtime inspection, policy inspection, and
requested release-mode inspection. The release tool returns
`GO_PROTOTYPE_ONLY` only for `explicit_prototype`; production-default,
scientific-release, and public-reference-image requests remain deterministic
`NO_GO` outcomes. Every tool cites the checksum-verified
`prototype-evidence-snapshot` and reports no per-record classification,
probability, accuracy, calibration, prevalence, or scientific claim.

The deterministic agent evaluation now contains thirty tool cases plus the
stored credential-free public replay. Prototype cases explicitly test the
81-row aggregate reference bank, rights restrictions, route shortfalls,
BioCLIP revision and embedding evidence, YOLOE routing-only authority, staged
operational counts, distinct `0.02` and `0.10` thresholds, unavailable
accuracy/calibration, and fail-closed release modes.

Both local export surfaces now prepare six deterministic files. Research
outputs include a prototype-boundary payload, and Evidence Lens audit exports
include a prototype-release receipt. Their manifests cover five payloads,
remain unsigned, perform no network request, and add no scientific claim.

GitHits remained unavailable; the focused agent/export query and
adopted/rejected approaches are recorded at
`provenance/githits.jsonl#15.2`.

## Task 15.3 judge documentation and full acceptance

Task 15.3 updates the current README, Judge Guide, human-decision register, and
known-limitations document to the prototype bundle
`papilio-demoleus-prototype-67c1c2a3-v2`. The current judge contract is 25
checksum-verified artifacts, 20 sections, 29 section records, six unavailable
sections, zero media items, 12 read-only tools, 30 deterministic tool cases
plus the stored replay, 247 named checks, and six deterministic output files.

The full local acceptance matrix passed 670 Python tests, 111 Vitest tests,
strict TypeScript, three static-deployment contract tests, zero production npm
vulnerabilities, truthful fixture and provenance verification, both pinned
import-receipt checks, the BioMiner boundary at `67c1c2a3…`, and a 50-file
Pages artifact at `/taxalens/`. Chromium could not start on this host because
`libnspr4.so` is absent; the browser process exited before any page or test code
ran, so the limitation is recorded separately from product acceptance.

The pushed GitHub Pages build remains authoritative for the final source SHA
and deployment fingerprint. The guide directs judges to
`build-fingerprint.json` instead of copying a self-referential deployment SHA
into the same commit.

GitHits remained unavailable; the focused completion-report query and
adopted/rejected approaches are recorded at
`provenance/githits.jsonl#15.3`.
