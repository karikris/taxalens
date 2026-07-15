# BioMiner product handoff audit

## Decision summary

BioMiner already contains the scientific infrastructure TaxaLens needs to describe Phase 13 and the metadata-only portion of Phase 14, but it does not contain a human-verified Phase 14 result. TaxaLens should import the compact committed metadata manifests and consume future large artifacts through BioMiner's new content-addressed handoff contract. It should not copy the evaluation, reference, or storage modules.

The current BioMiner HEAD adds the previously missing operation-efficient handoff implementation. No BioMiner source change is required for this audit task. The next data-import work must either consume the committed compact files listed below or receive an explicit handoff URI/archive and expected SHA-256; it must not discover data by scanning an untracked run directory or remote prefix.

## Repository comparison

| Item | Value |
| --- | --- |
| TaxaLens starting SHA | `f770a37a6449b02da041c2317121e1c4b83cec44` |
| TaxaLens branch | `main` |
| BioMiner pinned SHA before this audit | `0561906d994d6b9e56e0b6405fdb68272759595f` |
| BioMiner current SHA | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| BioMiner branch | `main` |
| Commit distance | one commit |
| New commit | `75461d9c065af0cd96b41cd1f845c2e920f7ae34 infra: add operation-efficient storage handoffs` |
| BioMiner working tree | untracked local configuration, notes, logs, and counters; excluded from every conclusion and import recommendation |

The pinned commit already includes the Phase 13 evaluation infrastructure and the compact Phase 14 metadata handoff. The only committed difference from the pin to current HEAD is the storage-handoff implementation: 11 changed paths, 1,679 additions, and 7 deletions.

All evidence in this report was read from committed Git objects at BioMiner HEAD. No conclusion depends on a local untracked file.

## Phase 13 reviewed-evaluation infrastructure

### What is implemented

BioMiner contains versioned, tested infrastructure for:

- target-aware reviewed labels, including target presence, certainty, life stage, visual domain, route, geography, duplicate identities, split, second-review status, and unsuitable-for-species-identification state;
- deterministic sampling frames with query provenance, geography, subject size, visual domain, life stage, competitor margin, and text/image disagreement strata;
- balanced challenge and natural-stream holdout definitions;
- transitive leakage-safe grouping across content hashes, duplicate groups, owners, provider mirrors, observations, and geographic bursts;
- support, model-selection, calibration, threshold-selection, reference-final-test, balanced-challenge, and natural-stream partition isolation;
- calibrated target-verification metrics including precision, recall, PR-AUC, ROC-AUC, specificity, coverage, abstention rate, selective risk, Brier score, log loss, calibration error, OOD false-positive rate, and detector-gate recall;
- calibration reliability bins and threshold operating points;
- target/competitor margin distributions;
- grouped bootstrap confidence intervals;
- slices by geography, country, no-geo, route, life stage, visual domain, subject-size band, query tier, search term, source provider, and visual-input kind;
- confusion matrices, review examples, QA, and report publication contracts.

### What is not materialized

The repository does not commit real reviewed-label, balanced-challenge, natural-stream, leakage-register, target-verification metric, calibration-reliability, grouped-confidence-interval, or final evaluation result artifacts for the Papilio pilot. The matching tracked paths are implementation and tests, not result data.

Therefore TaxaLens may adapt the schemas and display an explicit evaluation-unavailable state. It may not show Phase 13 test fixtures or synthetic expected metrics as the Papilio pilot's scientific evaluation.

## Phase 14 geographic workload

Task 14.1 is committed as metadata-only workload evidence. The compact manifest records:

| Metric | Committed value |
| --- | ---: |
| Input query hits | 76,485 |
| Canonical photos | 13,501 |
| Geotagged photos | 13,501 |
| Located clusters | 76 |
| Fallback clusters | 1 |
| Unassigned geotagged records | 792 |
| Outlier records | 707 |
| Allocated target-reference quota | 100 |

These values describe Flickr candidate workload and planning. They are not occurrences, labels, identities, model outputs, or successful classifications. `no_geo` and `unassigned_geo` are excluded from reference support in the committed policy.

The compact committed manifest contains hashes for the underlying cluster, assignment, canonical-geography, and query-hit artifacts. Those large run artifacts are not committed in the BioMiner repository and are not available to TaxaLens merely because a path and digest are documented.

## Phase 14 target range and candidate planning

The target-range metadata build records 19,201 GBIF occurrence records, 57,603 multi-resolution evidence rows, 16,678 spread rows, and 630 records eligible for range inference. This is independently sourced range evidence for planning; it does not verify Flickr candidates.

The regional compiler produced 30 accepted *Papilio* competitor candidates and selected five source-acquisition priorities: *Papilio memnon*, *P. polytes*, *P. helenus*, *P. paris*, and *P. machaon*. Five reviewed false-winning genera yielded 37 biological-negative candidates across *Graphium*, *Pachliopta*, *Ornithoptera*, *Protographium*, and *Losaria*. These are candidate hypotheses or model-error probes, not truth labels.

The B0-B16 experiment matrix is a committed execution contract. It specifies baselines, reference strategies, full-frame visual-input ablations, geography fallback, calibration separation, and required slices. It contains no completed ablation result.

## Trust-first reference planning and shortfalls

The committed source plan contains 22 registry-matched accepted taxa and explicit target, competitor, reviewed-false-winner, historical-false-winner, broader-family, and larval quotas. Metadata acquisition completed 22 checkpoints and produced:

| Metric | Committed value |
| --- | ---: |
| Raw occurrence rows | 91,180 |
| Unique occurrence rows | 91,176 |
| Raw media-candidate rows | 142,878 |
| Unique media candidates | 142,873 |
| Eligible source media candidates | 838 |
| Human-verified source media | 0 |
| Located observations | 64,914 |
| Global-fallback observations | 26,262 |
| Candidate shortfall | 247 |
| Human-verified shortfall | 490 |

The source-bank status is `awaiting_human_review_or_additional_sources`.

The negative/reference gaps remain material:

- five regional competitors have eight missing per-species candidate slots in aggregate reporting;
- reviewed false-winner genera have 60 missing per-species slots;
- the historical false winner has zero candidates against a quota of 20;
- broader Papilionidae has 60 candidates against a quota of 100;
- the separate target-caterpillar bank has one candidate against a quota of 20;
- other-insect or moth negatives have zero candidates against a quota of 100;
- visual-domain negative selection remains unresolved human work.

Candidate media, provider verification, and taxon reconciliation do not establish that an image is verified support. No candidate from this handoff may enter a support bank until rights, attribution, duplicate resolution, human review, and leakage-safe split gates pass.

## Storage handoff added after the TaxaLens pin

BioMiner HEAD introduces these versioned contracts:

- `storage-handoff-inventory-v1.0.0`;
- `storage-handoff-upload-receipt-v1.0.0`;
- `storage-handoff-receive-receipt-v1.0.0`.

The stable CLI surface is:

- `biominer storage handoff-build`;
- `biominer storage handoff-upload`;
- `biominer storage handoff-receive`.

The implementation builds a deterministic `tar.gz`, embeds a sorted inventory with byte counts and SHA-256 values, binds the inventory to a full source Git SHA, verifies content-addressed filenames, rejects symlinks and unsafe members, streams one upload/download, reuses a verified local cache, extracts with temporary files and atomic publication, and writes local receipts.

Important limits are explicit:

- producer upload acknowledgement is not end-to-end remote integrity;
- receiver verification establishes archive and embedded-file integrity;
- the receiver uses an explicit URI and digest and does not list a prefix;
- receipts are local and do not create a second remote completion state;
- an ambiguous failed upload must not be blindly retried.

TaxaLens Task 2.2 should consume this contract or invoke the stable command. It should not copy `src/biominer/storage/handoff.py`.

## Completed versus blocked

| Area | Status | Product meaning |
| --- | --- | --- |
| Phase 13 schemas and evaluation machinery | implemented and tested | adapters may be written |
| Real Papilio Phase 13 reviewed result artifacts | unavailable | metrics UI must say unavailable |
| Phase 14.1 geographic workload | complete metadata handoff | workload dashboard may use candidate semantics |
| Phase 14.2 positive/competitor metadata | partially complete | reference planning and shortfalls may be shown |
| Biological negatives | partially complete | false-winner candidates exist; insect/moth quota is empty |
| Visual-domain negatives | human selection unresolved | no support/negative bank claim allowed |
| Human-reviewed reference bank | blocked; verified count zero | no verified support images |
| Immutable leakage-safe split freeze | blocked by review | no calibration/final-test claims |
| B0-B16 model ablations | blocked | matrix is a plan, not a result |
| Calibration and selective-policy selection | blocked | no Phase 14 probabilities |
| Final Phase 14 evaluation | blocked | no precision/accuracy claim |
| Phase 15/default-policy change | unauthorized | production default unchanged |
| Operation-efficient storage handoff | implemented at current HEAD | exact bundles can be transferred and verified |

## Target-aware versus legacy family-first paths

BioMiner preserves both target-aware scientific contracts and a family-first legacy/baseline path. Recent commits `d949c18…` and `94efde4…` explicitly implement and version family-first candidate provenance. The Phase 14 matrix labels the current text-pruned baseline as B0 and includes non-pruned and target-aware alternatives for future evaluation.

TaxaLens must not treat a family-first shortlist, family-constrained rerank, or target-screening diagnostic as the target-aware product decision. The product may show legacy results only as clearly labelled diagnostic/baseline evidence. Product decisions must preserve the target, score the complete configured candidate union, retain full-frame inputs, and use a compatible committed calibrator before displaying probabilities.

No Phase 14 experiment has selected a replacement default.

## Committed artifacts TaxaLens should consume

| BioMiner path at `75461d9…` | Intended TaxaLens use | Restrictions |
| --- | --- | --- |
| `docs/verification/target_aware_phase_14_report.md` | human-readable handoff summary and blocked-state evidence | not a result bundle by itself |
| `config/pilot/papilio_demoleus_phase14_experiment_matrix.json` | versioned experiment and prerequisite contract | B0-B16 are planned, not completed |
| `config/pilot/papilio_demoleus_geographic_workload.json` | workload policy and target configuration | candidates are not occurrences |
| `examples/species/papilio_demoleus/pilot_geographic_workload_manifest.json` | compact workload counts, provenance, and artifact digests | referenced large Parquet files are not committed |
| `config/pilot/papilio_demoleus_reference_source_queries.json` | source-acquisition groups and quotas | candidate plan only |
| `examples/species/papilio_demoleus/pilot_reference_source_manifest.json` | compact source counts, shortfalls, and fingerprints | verified support count is zero |
| `config/candidates/papilio_demoleus_competitor_relationships.json` | reviewed candidate-relationship configuration | diagnostic candidate evidence, not taxonomic truth |
| a future explicit `storage-handoff-inventory-v1.0.0` archive | large Parquet evidence for judge analytics | require exact URI/archive, SHA-256, embedded inventory, receipt, and source SHA |

No untracked `runs/`, local configuration, log, or query-counter path should be imported. No remote prefix should be listed to discover a bundle.

## GitHits investigation

- Query: `Python repository version diff audit for deterministic content-addressed data handoff manifests with source commit, sorted inventory, checksums, atomic extraction, receipts, and explicit incomplete artifacts`.
- Repositories inspected: `latent-to/optima` at `990721bc4c6221c4742c1b1827c9aa3048c88628` and `iiyazu/Cross-Muse` at `97f8d0c393b938fe6d37924a1e549de67be9961b`.
- Adopted: manifest-only release inputs, exact revision/digest binding, strict schema checks, verified receipts, temporary paths before publication, and explicit incomplete state.
- Rejected: copying a full handoff implementation, SQLite backup patterns, and treating code diffs as proof of scientific result availability.
- Licence notes: GitHits reports Apache-2.0 for Optima and MIT for Cross-Muse. No external code was copied or adapted.
- Full record: `provenance/githits.jsonl#0.2`.

## Task verification

- `uv run pytest -q tests/test_storage_handoff.py tests/test_target_verification_metrics.py tests/test_phase14_pilot_contract.py` in BioMiner: `19 passed`.
- `uv run --with pytest --with polars --with pillow --with pyarrow python -B -m pytest -q` in TaxaLens: `533 passed`.
- TaxaLens provenance and contract-smoke demo verifiers: passed.
- BioMiner boundary verifier in dry-run audit mode: completed and reported the expected stale pin plus excluded untracked files. Strict verification remains a Task 0.3 gate.
- GitHits JSONL validation and `git diff --check`: passed.

This audit authorizes artifact-first adapters and explicit unavailable states. It does not authorize scientific claims, reference promotion, model selection, or a production-default change.
