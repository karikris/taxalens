# TaxaLens AI code provenance and BioMiner cutoff report

**Audit status:** Evidence-based, judge-facing source and model ledger. It distinguishes proof from inference.
**Audit date:** 2026-07-16 (Australia/Sydney)
**TaxaLens code snapshot:** 5963bd0aaa415af896f3f67a3accc7cb0670d7cf
**BioMiner code snapshot:** 75461d9c065af0cd96b41cd1f845c2e920f7ae34
**BioMiner pre-cutoff baseline:** 98ba9ca1c0af89396263455af31d4c22c04a07d9
**Cutoff:** 2026-07-11 00:00:00 Australia/Sydney; “after” means on or after that instant.

## Judge summary

TaxaLens is a new researcher-facing evidence and replay product built on the
separately versioned BioMiner research engine. The audited code has three
distinct origins:

- **8,054 of 39,471 production ELOC (20.41%)** are an exact retained match to
  a BioMiner source line pinned by the TaxaLens migration manifest.
- **2,965 ELOC (7.51%)** are manifest-bound TaxaLens extractions/adapters:
  local code that reads or transforms a declared BioMiner contract, rather than
  a copied engine implementation.
- **28,486 ELOC (72.17%)** are currently classified as TaxaLens-native code:
  product/replay modules, scripts, contracts, and the judge web application.
  This classification is deliberately conservative: no unpinned BioMiner
  source is silently treated as copied.
- **27,423 ELOC (69.48%)** have a current Git trailer explicitly naming
  GPT-5.6 Sol. This is a documented lower bound, not a style-based guess.
- There is no committed current-line attribution to GPT-5.5 or Spark 5.3.
  **12,048 ELOC (30.52%)** remain model-unavailable/no-trailer rather than
  being assigned speculatively.

The [OpenAI Build Week Rules](https://openai.devpost.com/rules) require
pre-existing projects to distinguish prior work from the Build Week extension
with dated evidence. They also require the README/video to explain Codex and
GPT-5.6 use and require the majority-core Codex /feedback Session ID. This
report supplies code-origin and model-trailer evidence; it does not substitute
for the working project, demo video, README, or /feedback result.

## Evidence standard

This report does not infer authorship from source style, commit-message tone,
or another model. It uses only:

1. current-file Git blame;
2. the AI-Primary-Model trailer on the blamed TaxaLens commit;
3. for each manifest-declared migration, an exact line-preserving alignment
   against its named BioMiner source at its full source SHA, followed by
   upstream Git blame; and
4. Git author timestamps for the BioMiner cutoff analysis.

An **effective code line (ELOC)** is a nonblank production source line after
excluding single-line comments. The TaxaLens scope includes Python, TypeScript,
TSX, JavaScript/MJS, and CSS under packages/replay/src, taxalens, scripts,
packages/contracts/src, apps/web/src, and apps/web/scripts. Tests, fixtures,
documentation, JSON/Parquet data, dependencies, binaries, and generated build
products are excluded.

An **exact upstream** line is textually aligned to the source named in
[the migration manifest](../provenance/biominer_migration_manifest.yaml).
Renamed imports, local headers, and adapter code do not count as copied. No
historical model or session ID is inferred where the repository does not record
one.

## TaxaLens origin ledger

| Production category | Files/components | ELOC | Share | Exact BioMiner ELOC | Meaning |
| --- | ---: | ---: | ---: | ---: | --- |
| Mechanical BioMiner copies | 14/14 | 8,020 | 20.32% | 7,978 | Committed BioMiner implementation retained with small import/provenance changes. It is not claimed as new TaxaLens invention. |
| Manifest-bound BioMiner adapters/extractions | 11/11 | 2,965 | 7.51% | 76 | Local TaxaLens code reading, validating, normalizing, or summarizing declared BioMiner artifacts/contracts. |
| TaxaLens-native/unmapped source | 102 | 28,486 | 72.17% | 0 | Product facade, judge bundle/replay, scripts, contracts, and web application. |
| **All audited production source** | **127** | **39,471** | **100.00%** | **8,054** | **20.41% literal BioMiner match; 79.59% local/adapted source.** |

The broader artifact-first BioMiner relationship is 10,985 ELOC (27.83%):
8,020 copied compatibility lines plus 2,965 manifest-bound adapter lines. It
describes integration provenance, not copied-code volume. The stricter
copied-source number is 7,978 ELOC.

### Exact component map

Exact is the number of destination ELOC aligned to the component’s declared
BioMiner source. Local is the remainder of that module. Each row has a full
source SHA, source path, licence field, rationale, status, and test list in the
migration manifest.

| Destination module | Kind | ELOC | Exact | Local | Declared BioMiner source |
| --- | --- | ---: | ---: | ---: | --- |
| biominer_decision_policy.py | copied | 834 | 830 | 4 | ml/decision_policy.py @ 0561906… |
| biominer_target_aware_output.py | copied | 1,029 | 1,026 | 3 | bioclip/target_aware_output.py @ 1535c49… |
| biominer_storage_parquet.py | copied | 145 | 145 | 0 | storage/parquet.py @ 1535c49… |
| biominer_nonmatch.py | copied | 902 | 898 | 4 | ml/nonmatch.py @ 1535c49… |
| biominer_calibration_contract.py | extracted | 4 | 1 | 3 | ml/calibration.py @ 1535c49… |
| biominer_training_task_contract.py | extracted | 11 | 9 | 2 | ml/training_features.py @ 1535c49… |
| biominer_visual_input_fusion.py | copied | 1,535 | 1,531 | 4 | bioclip/visual_input_fusion.py @ 1535c49… |
| biominer_reference_routes.py | extracted | 6 | 4 | 2 | references/readiness.py @ 1535c49… |
| biominer_target_full_frame.py | copied | 862 | 856 | 6 | vision/target_full_frame.py @ 1535c49… |
| biominer_detection_schema.py | copied | 327 | 324 | 3 | detection/schema.py @ 1535c49… |
| biominer_full_frame_attention.py | copied | 1,162 | 1,160 | 2 | vision/full_frame_attention.py @ 1535c49… |
| biominer_detection_policy.py | copied | 237 | 236 | 1 | detection/policy.py @ 1535c49… |
| biominer_detection_routing.py | copied | 382 | 382 | 0 | detection/routing.py @ 1535c49… |
| biominer_detector_base.py | copied | 166 | 166 | 0 | detection/detector_base.py @ 1535c49… |
| biominer_run_manifest_adapter.py | extracted | 191 | 5 | 186 | run/manifest.py @ 1535c49… |
| biominer_stage_metrics_adapter.py | extracted | 473 | 3 | 470 | run/stages.py @ 1535c49… |
| biominer_target_aware_scores_adapter.py | extracted | 276 | 9 | 267 | bioclip/target_aware_output.py @ 1535c49… |
| biominer_candidate_set_summary_adapter.py | extracted | 195 | 10 | 185 | bioclip/target_aware_output.py @ 1535c49… |
| biominer_reference_readiness_adapter.py | extracted | 408 | 10 | 398 | references/readiness.py @ 1535c49… |
| biominer_reference_review_queue_adapter.py | extracted | 306 | 9 | 297 | references/schemas.py @ 1535c49… |
| biominer_query_geography_adapter.py | extracted | 941 | 14 | 927 | compiler/geographic contracts @ 1535c49… |
| biominer_object_evidence_summary_adapter.py | extracted | 154 | 2 | 152 | evidence/join.py + metrics.py @ 1535c49… |
| biominer_evidence_review_policy.py | copied | 29 | 19 | 10 | evidence/review_policy.py @ 1535c49… |
| biominer_vision_gates.py | copied | 333 | 328 | 5 | vision/gates.py @ 1535c49… |
| biominer_semantic_hash.py | copied | 77 | 77 | 0 | common/semantic_hash.py @ 1535c49… |

All source paths are beneath BioMiner src/biominer. The comparison used
committed Git objects only and intentionally excluded the dirty BioMiner
working tree.

### Current function inventory

The current TaxaLens Python AST inventory contains **643 functions/methods**,
including methods and nested helpers.

| Function group | Functions | Direct-source functions | Interpretation |
| --- | ---: | ---: | --- |
| Copied BioMiner modules | 283 | 283 | Every one meets the 80%-exact threshold and remains upstream engine code. |
| Manifest-bound adapters/extractions | 93 | 0 | Local adapter functions; their contract origin is recorded but their bodies are not called copied. |
| TaxaLens-native/unmapped modules | 267 | 0 | Product, bundle, verifier, CLI, and web-support functions. |
| **Total** | **643** | **283** | **The function result corroborates the ELOC ledger.** |

Representative direct BioMiner functions include
generate_full_frame_attention_variants (298/298 exact),
score_nonmatch_evidence (266/266), fuse_full_frame_visual_evidence
(214/214), apply_selective_decision_policy (144/144), and
build_target_full_frame_plan (138/138).

Representative local adapter functions include adapt_query_geography_artifacts
(221 ELOC, 0 exact), adapt_reference_readiness (179 ELOC, 4 exact),
adapt_reference_review_queue (175 ELOC, 1 exact), and adapt_stage_metrics
(166 ELOC, 1 exact).

### Manifest completeness flag

Two current GPT-5.6 Sol replay modules are named as BioMiner phase adapters but
are not among the 25 migration-manifest destination rows:

- packages/replay/src/biominer_phase13_evaluation_adapter.py — 942 ELOC;
- packages/replay/src/biominer_phase14_pilot_adapter.py — 646 ELOC.

They are classified as local/unmapped here; the audit makes no copied-source
claim for them. If either adapts a BioMiner code component rather than only
committed data artifacts, add a migration-manifest row with the source SHA,
path, migration kind, rationale, licence, tests, and status before submission.

## Model-attribution ledger

### Evidence-only model proportions

| Writer model | Directly evidenced current ELOC | Share | Confidence | Basis |
| --- | ---: | ---: | --- | --- |
| GPT-5.6 Sol | 27,423 | 69.48% | High | The blamed TaxaLens commit records AI-Primary-Model: gpt-5.6-sol. |
| GPT-5.5 | 0 | 0.00% | High for “no evidence”; unknown for use | No reachable current TaxaLens/BioMiner commit trailer names GPT-5.5. |
| Spark 5.3 | 0 | 0.00% | High for “no evidence”; unknown for use | No reachable current TaxaLens/BioMiner commit trailer names Spark 5.3. |
| Model unavailable/no trailer | 12,048 | 30.52% | High that the gap exists | No reliable basis to allocate this code among GPT-5.5, Spark, GPT-5.6, and human work. |
| **Total** | **39,471** | **100.00%** |  |  |

The 27,423 GPT-5.6 Sol lines include 20,401 ELOC in the current judge web
application and 7,022 ELOC in the Python product/replay, contracts, and
support scripts. They cover the user-facing Research Mission, Evidence
Observatory, deterministic replay/bundle, product facade, and supporting
verification/build paths.

The documented GPT-5.6 Sol lower bound exceeds half of the audited current
TaxaLens production source. This is a code-volume measurement, not by itself
proof that a majority of every possible definition of “core functionality” was
built in one session. The required /feedback Session ID remains the controlling
competition evidence.

### Delivery versus original-source provenance

| View | GPT-5.6 | unavailable-in-session-context | no model trailer | Correct interpretation |
| --- | ---: | ---: | ---: | --- |
| TaxaLens current-line delivery commit | 27,423 (69.48%) | 8,173 (20.71%) | 3,875 (9.82%) | Shows the model recorded on the last TaxaLens delivery commit. |
| Original semantic source after exact mapping | 27,423 (69.48%) | 177 (0.45%) | 11,871 (30.08%) | Correct source-author view; BioMiner source lacks model trailers, so copied lines remain unallocated. |

At the TaxaLens code snapshot, the reachable history contains 284 commits:
64 explicitly GPT-5.6 Sol, 27 marked unavailable-in-session-context, and 193
without an AI-primary-model trailer. The reachable BioMiner history contains
772 commits and none has an AI-primary-model trailer.

Zero in the GPT-5.5 and Spark rows means **zero documented current-line
attribution**, not that either model generated zero code. Do not turn the
unallocated row into an invented Spark/GPT-5.5 split.

## BioMiner: before/after 11 July 2026 code diff

This section answers the time-origin question for current BioMiner production
Python under src/biominer. It uses the author date of the Git commit that last
changed each current source line. It is therefore a precise **last-written**
ledger, not a claim that the line was first conceived on that date.

| Current BioMiner source, by last-writing commit date | ELOC | Share |
| --- | ---: | ---: |
| Before 2026-07-11 | 32,855 | 27.80% |
| On or after 2026-07-11 | 85,313 | 72.20% |
| **Current production Python** | **118,168** | **100.00%** |

The pre-cutoff baseline contained 130 Python files and 39,885 ELOC. The
current snapshot has 201 files and 118,168 ELOC: a net increase of **78,283
ELOC (196.27%)**.

The Git range diff from baseline 98ba9ca to current 75461d9 shows:

| Range statistic for src/biominer Python | Value |
| --- | ---: |
| Files with physical source changes | 151 |
| Physical lines added after cutoff | 91,898 |
| Physical lines deleted after cutoff | 7,546 |
| Net physical line change | +84,352 |
| Source-touching commits before cutoff | 417 |
| Source-touching commits on/after cutoff | 132 |

The difference between net physical lines and ELOC is expected: physical diffs
include blank lines and comments, while ELOC does not. A line initially written
before 11 July but edited after it is deliberately counted in the on/after
column because the post-cutoff commit is its current last-writing event.

### BioMiner component split

| BioMiner component | Python files | Before ELOC | On/after ELOC | On/after share |
| --- | ---: | ---: | ---: | ---: |
| benchmarks | 4 | 977 | 957 | 49.48% |
| bioclip | 28 | 4,261 | 20,317 | 82.66% |
| candidates | 5 | 0 | 2,763 | 100.00% |
| common | 5 | 28 | 77 | 73.33% |
| config | 1 | 269 | 0 | 0.00% |
| detection | 13 | 2,497 | 951 | 27.58% |
| evaluation | 17 | 2,495 | 8,104 | 76.46% |
| evidence | 6 | 826 | 4 | 0.48% |
| filter | 5 | 598 | 0 | 0.00% |
| flickr_comments | 3 | 1,051 | 0 | 0.00% |
| flickr_fetch | 8 | 2,314 | 2,136 | 48.00% |
| geography | 5 | 0 | 378 | 100.00% |
| ml | 9 | 0 | 9,801 | 100.00% |
| references | 16 | 0 | 21,381 | 100.00% |
| registry | 27 | 8,692 | 6,371 | 42.30% |
| reports | 4 | 727 | 804 | 52.51% |
| root modules | 5 | 1,812 | 3,563 | 66.29% |
| run | 9 | 2,258 | 2,366 | 51.17% |
| species | 2 | 104 | 0 | 0.00% |
| storage | 13 | 922 | 1,342 | 59.28% |
| vision | 8 | 1,417 | 3,453 | 70.90% |
| workstore | 8 | 1,607 | 545 | 25.33% |

The current AST inventory contains 4,467 BioMiner functions/methods:
1,453 wholly last-written before the cutoff (32.53%), 2,648 wholly
last-written on/after it (59.28%), and 366 mixed-age functions (8.19%).

The largest fully post-cutoff current areas are references (21,381 ELOC), the
post-cutoff portion of bioclip (20,317 ELOC), ml (9,801 ELOC), evaluation
(8,104 ELOC), and registry (6,371 ELOC). This demonstrates substantive
post-cutoff development without pretending that Git timestamps prove a
particular model wrote it.

## Honest use of the owner-supplied model history

The owner reports using only GPT-5.6 since 11 July 2026 and reports that a
majority of earlier TaxaLens work used Spark 5.3. The dated BioMiner result is
consistent with substantial post-cutoff work: 72.20% of its current production
ELOC was last written on/after the cutoff.

It still does not turn those BioMiner lines into a documented GPT-5.6 or Spark
allocation. BioMiner's reachable history has no model trailers. The
submission-safe statement is:

> TaxaLens has 27,423 production ELOC with explicit GPT-5.6 Sol commit
> provenance. Its 8,054 exact BioMiner source lines, and BioMiner’s 118,168
> production Python ELOC, have commit/source/date provenance but no
> retrospectively verifiable model identity. We preserve that distinction
> rather than making a model-estimate claim that the repository cannot prove.

To improve historical attribution, retain exported Codex session metadata
linked to affected commit SHAs, or add a signed human attestation identifying
model, tasks, dates, commits, and review status. Re-run this report after
adding evidence; do not use source appearance as a substitute.

## Presentation-ready disclosure

Use this in the README, Devpost description, or video:

> TaxaLens is a new evidence and replay product layer for BioMiner. At the
> submitted code snapshot, 8,054 of 39,471 audited production lines are exact
> retained BioMiner source; 2,965 further lines are manifest-bound artifact
> adapters; and 28,486 are TaxaLens-local product, replay, and web code.
> GPT-5.6 Sol is explicitly recorded on 27,423 current production lines,
> including the judge web application and deterministic evidence product
> surface. We separately disclose that BioMiner’s model history was not
> committed, while its code, source commits, and pre/post-11 July change ledger
> remain fully inspectable.

For the video, show the GPT-5.6-assisted Research Mission/Observatory flow,
then open the migration manifest beside one exact copied module and its
committed BioMiner source. Use the BioMiner cutoff table to explain the
project’s earlier research-engine lineage without calling its unrecorded model
history GPT-5.6 or Spark.

## Reproducibility and limits

The key checks can be reproduced from the repository roots:

    cutoff='2026-07-11T00:00:00+10:00'
    base=$(git -C BioMiner rev-list -1 --before="$cutoff" main)
    git -C BioMiner diff --numstat "$base" 75461d9 -- src/biominer
    git -C BioMiner blame --line-porcelain src/biominer/bioclip/target_aware_output.py
    git -C taxalens blame --line-porcelain apps/web/src/observatory/ObservatoryWorkspace.tsx
    cd taxalens && uv run pytest -q
    uv run python scripts/verify_provenance.py
    uv run python scripts/verify_demo.py

Limits:

- Git blame gives the last-writing commit for current lines, not first
  conception, prompt text, or individual human edits.
- Exact matching undercounts semantic reuse after a rewrite and intentionally
  does not call an adapter a copy merely because it consumes the same schema.
- The report does not make claims about model runtime quality, biological
  accuracy, throughput, user impact, or completion beyond the repository’s
  separately verified artefacts.
- Both repository working trees may contain uncommitted content after the
  snapshots above. All comparisons use committed Git objects only; no
  untracked content was read or added.

**Integrity conclusion:** The codebase now has a strong, testable GPT-5.6
production trail and an independently verifiable BioMiner source/time lineage.
Where model history is unavailable, the report says so rather than inventing
model proportions.
