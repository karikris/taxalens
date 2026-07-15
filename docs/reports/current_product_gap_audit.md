# Current product gap audit

## Decision summary

TaxaLens already has a substantial, tested library of migrated BioMiner contracts, but it is not yet a product slice. At the audited commit, the repository has no reproducible package manifest, product-facing facade, web application, judge-quality bundle, OpenAI analyst, deployment configuration, or end-to-end judge journey. The next work must stop broad engine copying and turn committed BioMiner artifacts into a deterministic, provenance-bound product experience.

The existing code can support the first slice as a scientific compatibility layer. It cannot yet support the primary claim that a new user can launch, inspect, understand, and export one coherent evidence workflow.

## Audit identity and instruction resolution

| Item | Audited value |
| --- | --- |
| TaxaLens repository | `karikris/taxalens` |
| TaxaLens branch | `main` |
| TaxaLens HEAD | `3b4e64ef724415845f1b6dbef45fe5ce1db56669` |
| TaxaLens upstream state | `main` aligned with `origin/main` |
| TaxaLens worktree | one unrelated untracked `TaxaLens-AGENTS.md:Zone.Identifier`; excluded from this task |
| BioMiner repository | `karikris/BioMiner` |
| BioMiner branch | `main` |
| BioMiner HEAD | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| BioMiner upstream state | `main` aligned with `origin/main` |
| BioMiner worktree | locally untracked configuration, notes, logs, and query counters; none are accepted as committed evidence |
| Approved instruction file | `AGENTS.md` |
| `AGENTS.md` SHA-256 | `39d8bf1df80402d0cfb135d1093618b120f288f525a516196c3ceb6f3eb04ccb` |
| Primary Codex model required by the task | `gpt-5.6-sol` |
| Reasoning effort required by the user | `high` |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` |

The pasted goal recommended `codex/taxalens-product-slice`, while the explicit current user instruction requires direct work on `main` with no branches. The explicit user instruction has higher precedence under `AGENTS.md`, so task commits will be made and pushed directly on `main`. History will not be rewritten or force-pushed.

The user also directed that missing engine-side code be added in BioMiner. BioMiner will therefore remain the authoritative engine and artifact producer. Missing engine handoff behavior may be implemented and published there when demonstrated; product facade, replay, and UI behavior remains TaxaLens-native.

## Evidence inspected

- root instructions, README, upstream boundary, human decisions, baseline, and known limitations;
- all tracked paths, package-manifest candidates, replay module/test inventories, fixture inventories, and recent commit provenance;
- migration manifest and all available provenance state;
- TypeScript replay contracts and all three verifier implementations;
- current report set;
- current TaxaLens test suite: `533 passed`;
- current committed BioMiner HEAD and its recent history;
- GitHits examples described in the task investigation below.

The repository currently contains 130 tracked files, 26 replay Python modules, 25 Python test modules, 47 test/demo fixture files, and eight modules named as adapters. There is no `pyproject.toml`, `uv.lock`, JavaScript package manifest, application directory, or frontend source.

## Repository classification

### Reusable scientific contracts

The following can be reused behind a product boundary:

- run manifest, stage metrics, query/geography, reference readiness, reference review queue, candidate set, object evidence, and target-aware score adapters;
- versioned TypeScript replay contracts for run, stage, media, geography, candidates, detection, visual inputs, references, scores, comments, revisions, and evaluation;
- semantic fingerprinting and bounded Parquet persistence;
- detector schema, route policy, visual-domain gates, full-frame attention, and target full-frame orchestration;
- visual-input fusion, non-match evidence, target-aware output, and selective decision policy;
- fixture-backed validation and the BioMiner-boundary, provenance, and demo verifiers.

These components preserve important scientific invariants: target retention, complete candidate scoring, full-frame inputs, raw/calibrated separation, explicit reference readiness, and selective abstention. Passing tests demonstrate compatibility behavior, not product completeness or current Phase 14 scientific success.

### Replay-ready adapters

The existing adapters can load bounded JSON fixture representations of:

- run summaries and stage status;
- query definitions and geographic summaries;
- reference readiness and review queues;
- candidate and object-evidence summaries;
- target-aware candidate scores.

The schema-smoke fixture and `scripts/verify_demo.py` establish an initial deterministic-manifest pattern. They do not form the judge bundle: the smoke fixture has no real licensed hero media, real end-to-end lineage, browser analytics, complete checksum inventory, or export path.

Several adapters report Parquet paths without forming a stable product API that reads and assembles the evidence. UI code must never import these `biominer_*` modules directly.

### Product-facing code

No product-facing implementation exists at this SHA.

- There is no `taxalens` Python package or CLI.
- There is no stable evidence facade.
- There is no Research Mission, Evidence Observatory, Evidence Lens, or Butterfly Dashboard.
- There is no browser-side schema validation, bundle loader, analytical replay, navigation shell, guided tour, or export interface.
- There are no browser, accessibility, keyboard, responsive-layout, or end-to-end tests.

The TypeScript contract file is a useful boundary definition, but contracts alone are not a product surface.

### Duplicate engine code

TaxaLens contains fifteen `biominer_*.py` implementation modules that are neither named adapters nor narrow contract files. Several are intentionally complete copies with redirected imports. This preservation work is useful evidence of compatibility, but increasing this set is now counterproductive.

No more broad BioMiner modules should be copied. In particular, TaxaLens should not copy acquisition, registry building, geographic planning, reference acquisition/review, model execution, calibration fitting, evaluation, storage handoff orchestration, or legacy family-first decision code. Future integration should consume committed artifacts and schemas, use thin adapters, or call a stable BioMiner command.

The already migrated modules may remain as tested compatibility contracts until product APIs make their role explicit. Their presence does not authorize exposing BioMiner's legacy family-first path as the target-aware product decision.

### Missing UI

All four required screens and their shared shell are absent. The missing experience includes:

- mission inputs, deterministic plan, approval boundary, and replay launch;
- a thirteen-stage pipeline view with research and engineering disclosure;
- actual browser analytics and measured work-avoided evidence;
- end-to-end record lineage and full-frame image comparison;
- candidate comparison after complete scoring;
- raw versus calibrated decision presentation;
- geography, references, evidence ledger, review queue, funnel, yield, and evaluation state;
- keyboard navigation, reduced motion, responsive layouts, failure/blocked/review/abstention states, and accessible chart descriptions.

### Missing judge data

The current `contract_smoke` data is intentionally synthetic schema evidence. A competition-ready bundle still needs:

- a versioned bundle contract and complete content-addressed inventory;
- verified import receipts tied to committed BioMiner SHA(s);
- real committed Phase 13/14 metadata where available;
- a bounded *Papilio demoleus* fixture with licensed redistributable media or an honest media-unavailable state;
- rights and attribution records for every displayed media asset;
- complete candidate/reference semantics and human-review requirements;
- expected UI counts, artifact checksums, lineage, replay traces, and deterministic exports;
- a truthful hero record in `awaiting_human_review` unless verified target classification evidence exists.

### Missing OpenAI integration

No deterministic research tool layer, Responses API integration, stored tool trace, credential-free analyst replay, agent trace UI, or agent evaluation suite exists. Current official OpenAI model/API documentation has not yet been recorded in this repository. GPT-5.6 must plan and explain the research workflow; it must not guess species or replace BioMiner evidence.

### Missing deployment

There is no one-command local replay, static production build, public hosted replay, reset mechanism, build fingerprint, CI deployment workflow, or static fallback. The primary judge path is therefore unavailable.

### Missing presentation assets

The README is two lines and does not present the product. The repository lacks a current Judge Guide, product preview, Build Week delta, Codex collaboration report, AI provenance report, product-slice report, screenshots, measured result strip, and final submission-verification evidence. The final deck and video are explicitly outside this goal, but the product must become ready for screenshots and recording.

### Human-gated scientific work

The following remain unavailable until BioMiner artifacts and human decisions prove them:

- verified reference review and readiness;
- leakage-safe split freeze;
- model ablations and calibration selection;
- Phase 14 precision, recall, PR-AUC, calibration, coverage, and final evaluation;
- a gold target identification or confirmed occurrence;
- candidate/reference media promotion into production support;
- comment-driven candidate promotion for a hero record when no real comment evidence exists.

## Explicit product-boundary answers

### What can already support the first product slice?

The tested replay schemas, JSON adapters, fingerprints, Parquet helper, full-frame/route/scoring/decision contracts, and verification scripts can support a facade and deterministic fixture loader. They give the UI truthful vocabulary for unavailable evidence, reference readiness, candidate counts, raw scores, calibrated evidence, abstention, and provenance. BioMiner's committed handoff tooling and Phase 13/14 artifacts can supply current data after Task 0.2 verifies exact files and SHAs.

### What should no longer be copied from BioMiner?

No complete engine subsystem should be copied merely to make it callable from TaxaLens. Acquisition, registry, geographic workload generation, reference planning/review, negatives, model inference, calibration, evaluation, and storage handoff implementation belong in BioMiner. TaxaLens should consume their committed manifests, Parquet, reports, summaries, fingerprints, and stable commands through a product facade.

### What blocks a truthful hero record?

There is no imported, checksum-bound judge bundle with verified rights and attribution; no complete product-level lineage assembly; no proven human-verified target result; no verified reference support set; and no committed calibrated Phase 14 decision ready for a probability display. Until those gates are satisfied, the hero record must remain an explicit candidate in `awaiting_human_review` or `abstain`, never a confirmed occurrence or successful classification.

### What can be shown honestly using metadata-only Phase 14 evidence?

Subject to exact artifact verification in Task 0.2, TaxaLens may show geographic workload, retrieval/query associations and hit counts, candidate clusters, target range evidence, plausible regional competitors, trust-first reference plans, biological-negative candidates, visual-domain-negative candidates, source-media counts, reference shortfalls, storage handoff fingerprints, and which scientific stages are blocked. These are workload, planning, candidate, and readiness facts. They are not occurrence, identity, reference-support, accuracy, or successful-classification claims.

### What must remain unavailable?

- confirmed occurrence and target-classification claims without verified review;
- calibrated probability without a committed compatible calibrator and independent evaluation;
- Phase 14 performance metrics that do not exist as committed reviewed artifacts;
- unverified candidate reference media as support;
- fabricated comments, gold labels, precision, accuracy, savings, or stakeholder outcomes;
- live Flickr, OpenAI, Supabase, Backblaze, GPU, or model-download requirements on the judge path;
- BioMiner's legacy family-first ranking as the TaxaLens target-aware decision;
- live actions without explicit approval.

## GitHits investigation

- Query: `Evidence-driven scientific research product with browser-based deterministic analytical replay, workflow observability, record-level provenance, uncertainty states, and evidence export UI patterns`.
- Repositories inspected: `nuumz/vinyan` at `e8d6f7fc6810d03708f8fc60b91982ea2c971157` and `intentweave/intentweave` at `d9e72cbdcc9ae51b3cbf339804332e8fc3e61d0c`.
- Adopted: deterministic stage dispatch; honest partial/failure states; a single versioned product contract source; explicit origin and review-state vocabularies; logical replay order.
- Rejected: generic `confidence` values, because TaxaLens raw evidence is not probability; direct `innerHTML` rendering, because the product requires React and accessible primitives; and a monolithic workflow executor, because TaxaLens must preserve the engine/product boundary.
- Licence notes: both inspected repositories are Apache-2.0 according to GitHits provenance, and the inspected IntentWeave file includes an Apache-2.0 SPDX declaration. No external code was copied or adapted.
- Full record: `provenance/githits.jsonl#0.1`.

## Recommended next boundary

1. Audit current committed BioMiner artifacts and identify the minimal handoff inputs.
2. Freeze the artifact-first product boundary in repository provenance.
3. Package the existing code and expose a stable TaxaLens facade before adding UI.
4. Build and verify the truthful judge bundle before designing around counts or images.
5. Implement the static four-screen replay against the facade only.

## Task verification

- `uv run --with pytest --with polars --with pillow --with pyarrow python -B -m pytest -q`: `533 passed`.
- `python3 -B scripts/verify_provenance.py`: passed for the existing migration manifest.
- `python3 -B scripts/verify_demo.py`: passed for the existing contract-smoke manifest.
- `python3 -B scripts/verify_biominer_boundary.py --biominer-path ../BioMiner --dry-run`: audit completed and intentionally reported the stale pinned SHA plus excluded untracked BioMiner content. Strict boundary verification remains a Phase 0 gate until Tasks 0.2 and 0.3 update the verified boundary.
- `python3 -m json.tool provenance/githits.jsonl`: passed.
- `git diff --check`: passed.

This report is an audit, not evidence that any missing product capability is complete.
