# TaxaLens AI code provenance and upstream-origin report

**Audit status:** Evidence-based snapshot. It states gaps rather than inferring historical model identities.
**Audited:** 2026-07-16 (Australia/Sydney)
**TaxaLens code snapshot:** f063469d15364f3d9ec3667a1c2d5314ed5c62f0
**BioMiner snapshot:** 75461d9c065af0cd96b41cd1f845c2e920f7ae34

## Judge summary

TaxaLens is a new, product-facing evidence and replay layer built on the independently versioned BioMiner research engine. It does not represent that engine as new TaxaLens work.

- **7,978 effective code lines (60.70%)** in 14 TaxaLens modules are exact retained matches to their declared, pinned BioMiner source. This is direct source provenance, not a style-similarity claim.
- **2,965 ELOC (22.56%)** are TaxaLens adapters constrained by 11 pinned BioMiner artifact contracts. They are local adapter bodies, not copied engine code.
- **2,159 ELOC (16.43%)** are TaxaLens-native product, CLI, contract, and verification code.
- **1,080 ELOC (8.22%)** are verifiably attributed by current Git trailers to GPT-5.6 Sol. They comprise the entire current TaxaLens Python product package and CLI, plus a replay-package bootstrap.
- There is **no committed model evidence** assigning a current production line to GPT-5.5 or Spark 5.3. That is an evidence gap, not a claim that those models were unused.

The [OpenAI Build Week Rules](https://openai.devpost.com/rules) require pre-existing projects to distinguish prior work from the Build Week extension with dated evidence. They also require a README/video explanation of Codex and GPT-5.6 use and the majority-core Codex /feedback Session ID. This document supplies the code-origin part of that evidence; it does not replace the required working project, video, README, or session ID.

## Evidence standard

Model authorship cannot be reliably recovered from source style, commit-message tone, or an LLM classifier. This audit uses only:

1. current-file Git blame;
2. the AI-Primary-Model trailer on the blamed commit;
3. for declared BioMiner copies, an exact line match against the manifest's named source file at its full SHA, followed by upstream Git blame; and
4. the versioned [migration manifest](../provenance/biominer_migration_manifest.yaml).

An **effective code line (ELOC)** is a nonblank Python or TypeScript source line after excluding single-line comments. Declarations, docstrings, and multiline source expressions are counted. This is a reproducible size measure, not a complexity or value measure.

A line is called **exact upstream** only when its text occurs in the selected line-preserving source alignment. Renamed imports, local provenance headers, and TaxaLens adaptation lines are not counted as copied. This report does not infer an unavailable historical model or session ID.

## Production-code origin ledger

| Production category | Files/components | ELOC | Share | Exact upstream | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| Mechanical BioMiner copies | 14/14 | 8,020 | 61.02% | 7,978 | Committed BioMiner implementation retained with small import/provenance changes; not claimed as new TaxaLens invention. |
| BioMiner-contract adapters/extractions | 11/11 | 2,965 | 22.56% | 76 | New TaxaLens code that reads, validates, normalizes, or summarizes declared BioMiner artifacts/contracts. |
| TaxaLens-native product/tooling | 13 | 2,159 | 16.43% | 0 | Product facade, product contracts, CLI, verification scripts, and TypeScript replay contracts. |
| **All audited production code** | **38** | **13,144** | **100.00%** | **8,054** | **61.28% literal BioMiner source match; 38.72% local/adapted source.** |

The broader artifact-first dependency relationship is 10,985 ELOC (83.57%): 8,020 copied compatibility lines plus 2,965 contract-bound adapter lines. That describes integration provenance, not copied-code volume. The stricter copied-source figure is 7,978/13,144.

### Complete component map

Exact is exact ELOC found in the component's declared BioMiner source; Local is the remainder of its current destination module. Every row has a full source SHA, source path, licence field, rationale, status, and tests in the migration manifest.

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

All paths above are beneath BioMiner src/biominer. The comparison read committed Git objects only; it did not use the dirty BioMiner working tree.

## Function-level evidence

The Python AST inventory contains **462 functions/methods**, including methods and nested helpers. A function is called direct only when at least 80% of its ELOC is exact to the declared BioMiner source.

| Function group | Functions | Direct-source functions | Interpretation |
| --- | ---: | ---: | --- |
| Copied BioMiner modules | 283 | 283 | All pass the direct-source threshold; do not present them as novel TaxaLens algorithms. |
| Contract adapters/extractions | 93 | 0 | New TaxaLens adaptation functions; their upstream contracts are identified but their bodies are not called copied. |
| TaxaLens-native modules | 86 | 0 | Product, CLI, verification, and contract functions local to TaxaLens. |
| **Total** | **462** | **283** | **The function view corroborates the line-level ledger.** |

Representative direct BioMiner functions:

- generate_full_frame_attention_variants — 298/298 exact ELOC;
- score_nonmatch_evidence — 266/266;
- fuse_full_frame_visual_evidence — 214/214;
- apply_selective_decision_policy — 144/144;
- build_target_full_frame_plan — 138/138; and
- build_detection_rows — 92/92.

Representative TaxaLens adaptation functions:

- adapt_query_geography_artifacts — 221 ELOC, 0 exact;
- adapt_reference_readiness — 179 ELOC, 4 exact;
- adapt_reference_review_queue — 175 ELOC, 1 exact;
- adapt_stage_metrics — 166 ELOC, 1 exact; and
- adapt_target_aware_candidate_scores — 122 ELOC, 7 exact.

This is the accurate product boundary: TaxaLens adds deterministic translation and presentation; BioMiner remains responsible for decision policy, full-frame processing, visual fusion, and non-match scoring.

## Model-attribution ledger

### Evidence-only result — the submission-safe numerical allocation

| Writer model | Directly evidenced current ELOC | Share | Confidence | Basis |
| --- | ---: | ---: | --- | --- |
| GPT-5.6 Sol | 1,080 | 8.22% | High | Current blamed line has a commit trailer naming gpt-5.6-sol. |
| GPT-5.5 | 0 | 0.00% | High for “no evidence”; unknown for use | No current TaxaLens or BioMiner trailer names GPT-5.5. |
| Spark 5.3 | 0 | 0.00% | High for “no evidence”; unknown for use | No current TaxaLens or BioMiner trailer names Spark 5.3. |
| Model unavailable/no trailer | 12,064 | 91.78% | High that the gap exists | The code cannot honestly be allocated among GPT-5.5, Spark, GPT-5.6, and human work without session evidence. |
| **Total** | **13,144** | **100.00%** |  |  |

Zero in the GPT-5.5 and Spark rows means **zero documented current-line attribution**, not that the model generated zero code. A non-zero number derived from code appearance would be fabricated provenance.

The defensible lower bounds are therefore **GPT-5.6 >= 8.22%, GPT-5.5 >= 0%, Spark >= 0%, and unallocated = 91.78%**. They are intentionally not forced into a speculative 100% model split.

### Delivery trail versus original-code trail

| View | GPT-5.6 | unavailable-in-session-context | no model trailer | Correct interpretation |
| --- | ---: | ---: | ---: | --- |
| TaxaLens last delivery commit | 1,080 (8.22%) | 8,173 (62.18%) | 3,891 (29.60%) | Records the last TaxaLens delivery commit; it cannot establish the original writer of copied code. |
| Original semantic source after exact mapping | 1,080 (8.22%) | 177 (1.35%) | 11,887 (90.44%) | The appropriate authorship view. Upstream BioMiner has no model trailers, so copied source remains unallocated. |

At the audited code snapshot, TaxaLens has 225 commits: 9 explicitly GPT-5.6 Sol, 27 marked unavailable-in-session-context, and 189 without an AI-primary-model trailer. BioMiner has 807 commits, all without an AI-primary-model trailer. This explains why retrospective model attribution cannot be completed from Git.

### Verified GPT-5.6 Sol functional scope

The 1,080 GPT-5.6 Sol ELOC are complete current files, not an inferred subset:

| File | GPT-5.6 Sol ELOC | Verified functions/responsibility |
| --- | ---: | --- |
| taxalens/cli.py | 161 | CLI, demo/provenance dispatch, Git SHA discovery, script execution. |
| taxalens/product/contracts.py | 103 | Immutable artifact/product contracts; freeze_json and thaw_json. |
| taxalens/product/facade.py | 756 | EvidenceFacade, checksum/schema checks, load_* views, lineage, deterministic export. |
| taxalens/product/__init__.py | 51 | Public product API surface. |
| taxalens/__init__.py and taxalens/__main__.py | 8 | Package identity and command entry point. |
| packages/replay/src/__init__.py | 1 | Replay package bootstrap. |
| **Total** | **1,080** | **Current TaxaLens product facade and shell.** |

The nine GPT-5.6 Sol commits record session 019f65d0-3ca9-7870-9eb2-37c14ed02517. This audit verifies that the ID is recorded in the commits only. The entrant must still run /feedback in the relevant session and provide the resulting Session ID under the Rules.

The verification scripts, TypeScript replay contracts, and 11 adapter modules have no recoverable exact model attribution in current Git history. They remain labelled **model unavailable**, even where commits describe Codex assistance.

## Timing check against the owner-supplied model history

The owner reports using only GPT-5.6 since 2026-07-11 and reports that a majority of TaxaLens code was written using Spark 5.3. This audit records that as human-supplied context, not machine evidence.

| Original introduction date of the 7,978 exact copied ELOC | ELOC | Share |
| --- | ---: | ---: |
| Before 2026-07-11 | 687 | 8.61% |
| On or after 2026-07-11 | 7,291 | 91.39% |

The Git record does **not** support a claim that all copied BioMiner code predates 11 July or that its model identity follows from the cutoff. The submission-safe claim is narrower and stronger: **TaxaLens has demonstrable, pinned BioMiner code origin, while historical model identity for that upstream code is not recorded.**

Do not replace the evidence-only table with an invented statement such as “Spark wrote 61%.” A model allocation can be upgraded only by source evidence: exported Codex session metadata linked to commit SHAs, or a signed attestation identifying model, task, dates, affected commits, and review status. Reblame and regenerate this ledger after adding it.

## Presentation-ready disclosure

Use this language in the README, Devpost description, and video:

> TaxaLens is a new evidence and replay product layer for the BioMiner research engine. Its committed provenance manifest shows that 7,978 of 13,144 audited production code lines are exact retained BioMiner implementation, while 2,965 lines are new artifact-contract adapters and 2,159 lines are TaxaLens-native product/tooling. GPT-5.6 Sol is explicitly recorded for the 1,080-line TaxaLens product facade and CLI. We do not retroactively assign unrecorded upstream code to a model; its full BioMiner commit and source-path provenance are available for inspection.

In the video, show the GPT-5.6-assisted facade/CLI, then the migration manifest and one copied module beside a Git source retrieval command. This makes the boundary legible: Codex/GPT-5.6 accelerated the product boundary, and BioMiner remains transparently credited as upstream work.

## Reproducibility and required follow-up

The audit enumerates production Python/TypeScript in packages/replay/src, taxalens, scripts, and packages/contracts/src; counts ELOC; reads every source only through committed Git objects; aligns exact lines; and reads model data only from Git trailers on blamed commits.

Run these independent checks from taxalens/:

    uv run python scripts/verify_provenance.py
    uv run python scripts/verify_biominer_boundary.py --dry-run
    uv run python scripts/verify_demo.py
    uv run pytest -q
    git show 1535c494f9403e22ed9b163f3ae0ce3706e17f4c:src/biominer/vision/full_frame_attention.py
    git blame --line-porcelain packages/replay/src/biominer_full_frame_attention.py

Before submission:

1. Record every new Build Week commit with exact model ID, session ID, reasoning effort, human review, and tests.
2. Retain the /feedback result for the session that built the majority of **new core functionality**; do not substitute a Spark or GPT-5.5 session.
3. Add evidence, not estimates, if historical Spark/GPT-5.5 attribution is material, then regenerate this report.
4. Keep claims within the repository's known limitations: provenance does not establish a hosted replay, product completion, model runtime performance, biological accuracy, throughput, or impact.

**Integrity conclusion:** This is a provenance ledger, not a marketing estimate. It separates proven BioMiner origin, proven GPT-5.6-assisted TaxaLens product work, and historical model authorship that remains unproven.
