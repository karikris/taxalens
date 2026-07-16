# Phase 14 report — artifact-first prototype evidence

Phase 14 was completed on **2026-07-16** from TaxaLens commit
`43d9c20` through `515c7f9`, using the reviewed BioMiner handoff at
`67c1c2a3a2c9b909b256b3094913af342f4ccbed`.

## Outcome

TaxaLens now consumes BioMiner’s committed *Papilio demoleus* few-shot
prototype through a fixed artifact allowlist and a thin product-owned adapter.
The public replay exposes aggregate reference-bank, runtime, benchmark, policy,
staged-inference, release, rights, and backlog evidence without importing
BioMiner engine code, image bytes, model weights, databases, caches, or
per-record candidate-score payloads.

The hero record remains `awaiting_human_review`. Aggregate prototype evidence
does not populate the unavailable YOLOE, full-frame visual-input,
target-aware-score, comment, revision, or reviewed-evaluation sections.

## Immutable work items

| Task | Commit | Delivered boundary |
| --- | --- | --- |
| 14.1 | `2741bc4` | Pinned and audited the current committed Phase 14/15 handoff |
| 14.2 | `ed0d383` | Imported a fixed 20-file compact artifact set from exact Git objects |
| 14.3 | `fab9d3f` | Added a checksum-verifying nine-section prototype evidence adapter |
| 14.4 | `515c7f9` | Rebuilt the judge fixture and added the shared prototype evidence panel |

## Verified prototype facts

| Evidence | Committed value | Claim boundary |
| --- | ---: | --- |
| Frozen support rows | 81 | Provider-supported metadata, not independent taxonomic review |
| Human-verified rows | 0 | Production reference support remains unavailable |
| Licence policy | 2 allowed, 79 research-only | No public reference-image display |
| Reference routes | 80 adult, 1 larval, 0 pinned specimen | Route shortfalls remain explicit |
| BioCLIP | 1,024 dimensions, 81 frozen embeddings | Aggregate runtime evidence only |
| Benchmark | 19 experiments | Retrieval/internal-consistency evidence, not accuracy |
| B0 / B13 target scoreability | 0.10 / 1.00 | Not classification accuracy |
| Selected policy | B13, raw margin `0.10` | Uncalibrated; emits no probability |
| Staged records | 13,496 / 13,501 | Operational execution, not prevalence |
| Candidate-score rows | 634,312 | Aggregate count; per-record payload is not imported |
| Staged diagnostic rule | `0.02` | Distinct from the selected `0.10` policy |

## Product projection

The truthful bundle is
`papilio-demoleus-prototype-67c1c2a3-v2`. It contains 25 inventoried artifacts,
20 sections, 29 section records, six unavailable sections, and zero media. The
new `prototype-evidence-snapshot` is a TaxaLens-normalized metadata artifact
whose source fingerprints resolve to the exact 20 imported BioMiner files.

Evidence Lens and Dashboard reuse one accessible panel. It shows operational
prototype evidence beside explicit no-accuracy, no-calibration, no-prevalence,
no-public-image, and no-scientific-release language.

## Verification at phase completion

- 649 Python tests passed.
- 111 Vitest tests passed.
- Strict TypeScript passed.
- Static build and deployment verification passed.
- Truthful demo, provenance, import receipt, rights, and checksum gates passed.
- Chromium E2E could not launch in the workspace because `libnspr4.so` was
  absent; no product assertion ran.

## Accepted limitations

- No reference label is independently human taxonomically verified.
- No calibrator or reviewed final-test scientific metric is available.
- Two support records lack owner evidence and 79 references are research-only.
- Focused/masked ablations, pinned-specimen support, larval `support_train`,
  final visual-domain negatives, and independent YOLOE route validation remain
  incomplete.
- The staged distribution must not be read as accuracy, occurrence, or
  prevalence.

Every Phase 14 task has a corresponding GitHits outage record, migration
manifest entry, exact upstream SHA, human-decision trailer, tests, and pushed
commit.
