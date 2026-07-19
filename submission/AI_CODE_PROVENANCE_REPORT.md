# TaxaLens AI code provenance and BioMiner cutoff audit

**Audit status:** judge-facing, reproducible source/date/model ledger
**Refreshed:** 2026-07-17 (Australia/Sydney)
**Audited TaxaLens snapshot:** `3c51cfe06da607ead868b7535032d8cdbdb59d12` (`main` and `origin/main`)
**Audited BioMiner snapshot:** `dcd494321abc0666ea692b5759f84bc4c7e08ba9` (`main` and `origin/main`)
**TaxaLens manifest BioMiner pin:** `74a7d648a562efa744e6502ef504a23b63b4e02f`
**BioMiner pre-cutoff baseline:** `98ba9ca1c0af89396263455af31d4c22c04a07d9`
**Model-era cutoff:** 2026-07-11 00:00:00 Australia/Sydney (UTC+10); “on/after” includes that instant.

## Executive answer

For the previously reported **8,054 exact BioMiner-source ELOC** in TaxaLens:

| Question | ELOC | Share of 8,054 | Evidence strength |
|---|---:|---:|---|
| Last written before 11 July 2026 | **710** | **8.82%** | Direct Git blame/date evidence |
| Last written on/after 11 July 2026 | **7,344** | **91.18%** | Direct Git blame/date evidence |
| Directly proved Configured model-written by an upstream model trailer | **0** | **0.00%** | No BioMiner commit in this subset has a Configured model trailer |
| Date-conditioned Configured model estimate | **7,344** | **91.18%** | Conditional on the owner statement that Configured model was the only model used from 11 July |
| Pre-cutoff model pool, unresolved among Spark 5.3 / prior-model attribution / human | **710** | **8.82%** | Git history has no model evidence that can split it |

The most useful estimate is therefore **7,344 ELOC attributable to the
Configured model era and 710 ELOC attributable to the pre-Configured model era**. The defensible
direct-evidence statement is narrower: **0 of those 8,054 lines has an
upstream Configured model model trailer**. Date is evidence of when a line was last
written, not by itself proof that a model wrote it.

The earlier “8,054 ELOC (20.41%)” wording is corrected here. Re-running the
declared production scope at the historical TaxaLens object
`5963bd0aaa415af896f3f67a3accc7cb0670d7cf` produces **39,485 ELOC**, including
14 ELOC in `apps/web/src/shell/shellTypes.ts` that the prior denominator
omitted. Thus **8,054 / 39,485 = 20.40%** when rounded to two decimal places.
Even the former denominator, 39,471, yields 20.40% under standard rounding;
20.41% is not reproducible.

## The two dates must not be conflated

The 11 July boundary is the owner-provided **model-transition date**. It
supports a Configured model-era estimate, but it is not the competition eligibility
boundary.

The [OpenAI Build Week rules](https://openai.devpost.com/rules) give a
submission period beginning **13 July 2026 at 9:00 a.m. Pacific Time** and say
that a pre-existing project must be meaningfully extended after the submission
period starts; only that added work is evaluated. They also require the
submission to document prior versus new work and evidence the use of Codex and
Configured model during the submission period. The repository's separate build-week
delta and session evidence must establish that eligibility. This report
answers source lineage and the 11 July model-era question; it does not relabel
11–12 July work as competition-period work.

## Evidence standard

No model is inferred from code style, vocabulary, formatting, commit-message
tone, or a model's claimed ability to recognize its own output. The audit uses:

1. `git blame --line-porcelain` at immutable Git objects;
2. the author timestamp of each line's last-writing BioMiner commit;
3. exact, contiguous line alignment to the authoritative source object named
   in `provenance/biominer_migration_manifest.yaml`;
4. `AI-Primary-Model` commit trailers when present; and
5. the owner's model-use statement only in a visibly labelled conditional
   estimate.

An **effective line of code (ELOC)** is a nonblank source line excluding a
single-line comment beginning with `#` or `//`. TaxaLens production scope is
Python, TypeScript, TSX, JavaScript/MJS, and CSS below
`packages/replay/src`, `taxalens`, `scripts`,
`packages/contracts/src`, `apps/web/src`, and `apps/web/scripts`.
Tests, fixtures, documentation, data files, dependencies, binaries, and build
outputs are excluded. BioMiner production scope is `src/biominer/**/*.py`.

An **exact BioMiner-source line** is a current destination line in a contiguous
line-preserving alignment to the migration row's first authoritative source
path at its declared source commit. Renamed imports, local headers, rewritten
logic, and adapters do not become “copied” merely because they serve the same
contract. This deliberately undercounts transformed semantic reuse while
avoiding false copy claims.

## Current TaxaLens production ledger

At the current audited snapshot, TaxaLens contains **77,863 production ELOC in
237 files**.

The four commits from `5e40553` through `3c51cfe` change documentation and
provenance metadata only. Their production trees are byte-identical, and the
migration manifest's component source paths and source commits are unchanged.

| Production provenance category | ELOC | Share | Exact BioMiner ELOC | Interpretation |
|---|---:|---:|---:|---|
| Mechanically copied components | 8,020 | 10.30% | 7,978 | BioMiner modules retained with 42 locally changed/nonmatching ELOC |
| Extracted contracts | 2,950 | 3.79% | 74 | Product contracts extracted around BioMiner semantics |
| Artifact adapters | 29,782 | 38.25% | 324 | TaxaLens-owned integration and presentation code |
| Native/unmapped TaxaLens | 37,111 | 47.66% | 0 | No migration-manifest BioMiner source relationship |
| **Total** | **77,863** | **100.00%** | **8,376** | Current exact overlap is 10.76% of production |

The broader **manifest-bound relationship** is 40,752 ELOC (52.34%). It
describes copied, extracted, and adapter boundaries together and must not be
presented as 40,752 copied lines. The strict current copy count is **8,376
exact ELOC**, of which 7,978 is in mechanically copied modules.

The current Python AST inventory contains **866 functions/methods**:
283 in copied components, 93 in extracted contracts, 126 in adapters, and 364
in native/unmapped modules. These are structural counts; a function can contain
lines from more than one date or model-evidence class.

## Current TaxaLens model ledger

The primary ledger follows semantic source. Exact retained BioMiner lines use
their upstream commit evidence rather than the later TaxaLens delivery commit.

| Semantic-source model evidence | ELOC | Share of current production |
|---|---:|---:|
| Configured model trailer | **65,183** | **83.71%** |
| No model trailer | **12,529** | **16.09%** |
| `unavailable-in-session-context` trailer | **151** | **0.19%** |
| Unattributed prior-model trailer | **0** | **0.00%** |
| Spark 5.3 trailer | **0** | **0.00%** |

This is a **last-writing semantic-source ledger**, not a claim that every
character in a Configured model-trailed commit was generated without human editing.
TaxaLens has 438 reachable commits at the audited object: 215 with a Configured model
trailer, 27 marked unavailable in session context, and 196 with no model
trailer.

A delivery-only view produces 65,514 Configured model ELOC, 4,206 ELOC with no trailer,
and 8,143 unavailable ELOC. The difference is expected: most exact BioMiner
source was delivered to TaxaLens by commits whose trailer describes the
delivery session, not the original source authorship. Delivery evidence must
not overwrite upstream provenance.

## Current exact BioMiner-source subset in TaxaLens

Current exact overlap is **8,376 ELOC**:

| Current exact subset | ELOC | Share |
|---|---:|---:|
| Last written before cutoff | **741** | **8.85%** |
| Last written on/after cutoff | **7,635** | **91.15%** |
| Direct upstream Configured model trailer | **0** | **0.00%** |
| Direct upstream prior-model trailer | **0** | **0.00%** |
| Direct upstream Spark 5.3 trailer | **0** | **0.00%** |
| No upstream model trailer | **8,376** | **100.00%** |

Under the owner's “Configured model only since 11 July” statement, the
**date-conditioned current Configured model ceiling is 7,635 ELOC**. The verified
minimum remains zero because no upstream Configured model trailer exists. The 741
pre-cutoff ELOC cannot be truthfully divided among Spark 5.3, prior-model attribution, and
human work from the repository alone.

TaxaLens delivery commits for these 8,376 exact lines are: 331 ELOC delivered
in Configured model-trailed commits, 7,992 ELOC in unavailable-session commits, and 53
ELOC in commits with no trailer. Those numbers describe migration/delivery,
not original BioMiner authorship.

### Exact mechanically copied modules

| BioMiner-derived module/family | Exact ELOC |
|---|---:|
| `visual_input_fusion` | 1,531 |
| `full_frame_attention` | 1,160 |
| `target_aware_output` | 1,026 |
| `nonmatch` | 898 |
| `target_full_frame` | 856 |
| `decision_policy` | 830 |
| `detection_routing` | 382 |
| `vision_gates` | 328 |
| `detection_schema` | 324 |
| `detection_policy` | 236 |
| `detector_base` | 166 |
| `storage_parquet` | 145 |
| `semantic_hash` | 77 |
| `evidence_review_policy` | 19 |
| **Mechanically copied exact total** | **7,978** |

An additional 74 exact ELOC occurs in extracted contracts and 324 exact ELOC
in adapters. These are disclosed as exact textual overlap, but the containing
files remain classified by their architectural role.

## Requested historical 8,054-line subset

This section freezes the exact figures requested by the owner rather than
silently replacing them with the current 8,376-line count.

**TaxaLens object:** `5963bd0aaa415af896f3f67a3accc7cb0670d7cf`
**Comparison BioMiner report object:** `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
**Source truth:** each migration component's own pinned `source_commit`

| Historical 8,054-line question | ELOC | Share | Correct presentation |
|---|---:|---:|---|
| Pre-11-July source | **710** | **8.82%** | BioMiner legacy-era exact source |
| On/after-11-July source | **7,344** | **91.18%** | Configured model-era exact source |
| Strictly proved Configured model | **0** | **0.00%** | No upstream model trailers |
| Estimated Configured model, conditioned on owner statement | **7,344** | **91.18%** | Use “estimate” or “date-conditioned,” never “Git-proved” |
| Unresolved pre-cutoff model/human pool | **710** | **8.82%** | Do not invent a Spark/unknown-model split |

All 8,054 lines blame upstream BioMiner commits with no model trailer.
TaxaLens delivery commits for this historical subset were 7,996 ELOC marked
`unavailable-in-session-context` and 58 ELOC with no trailer; none had a
Configured model delivery trailer. Again, that delivery view does not change the source
lineage.

### Presentation-ready statement

> TaxaLens retained 8,054 exact effective lines from versioned BioMiner source
> at the historical audit snapshot. Git blame dates 710 ELOC (8.82%) before
> 11 July 2026 and 7,344 ELOC (91.18%) on or after that date. Because the owner
> reports using only Configured model from 11 July, 7,344 ELOC is the transparent
> date-conditioned Configured model estimate. BioMiner lacks per-commit model trailers
> for these lines, so the strict Git-proved Configured model count is zero and the 710
> pre-cutoff ELOC remains unresolved among Spark 5.3, prior-model attribution, and human work.

This wording demonstrates BioMiner origin without falsely claiming that
source migration itself proves a particular generating model.

## BioMiner before/after cutoff diff

At current BioMiner `dcd4943`:

| Current production Python, by last-writing commit | ELOC | Share |
|---|---:|---:|
| Before 2026-07-11 00:00 Sydney | **31,317** | **24.28%** |
| On/after 2026-07-11 00:00 Sydney | **97,688** | **75.72%** |
| **Total** | **129,005** | **100.00%** |

The pre-cutoff tree `98ba9ca` contained **39,885 ELOC in 130 Python files**.
The current tree contains **129,005 ELOC in 209 Python files**, a net ELOC
growth of **89,120 (+223.44%)**. The tree diff from baseline to current spans
178 changed Python files, 105,163 physical additions, and 9,225 physical
deletions, for a 95,938-line physical net. Physical diff lines and ELOC differ
because ELOC excludes blanks and single-line comments and because current-line
blame does not count deleted lines.

There are 583 source-touching commits in the audit history: 417 before the
cutoff and 166 on/after. Across all 813 commits reachable from current
BioMiner, 798 have no `AI-Primary-Model` trailer and 15 are marked
`unavailable-in-session-context`; none has a Configured model, prior-model attribution, or Spark 5.3
trailer. At line level, 128,957 current ELOC have no model trailer and 48 ELOC
are unavailable in session context.

Under the owner's date statement, current BioMiner therefore has a
**date-conditioned Configured model ceiling of 97,688 ELOC (75.72%)**, with 31,317 ELOC
in the unresolved pre-cutoff pool. The direct model-trailer count remains zero.

### BioMiner production components

| Component | Before ELOC | On/after ELOC | On/after share |
|---|---:|---:|---:|
| `benchmarks` | 942 | 6,940 | 88.05% |
| `bioclip` | 4,141 | 21,087 | 83.59% |
| `candidates` | 0 | 2,763 | 100.00% |
| `common` | 21 | 77 | 78.57% |
| `config` | 269 | 0 | 0.00% |
| `detection` | 2,243 | 901 | 28.66% |
| `evaluation` | 2,144 | 7,958 | 78.78% |
| `evidence` | 826 | 4 | 0.48% |
| `filter` | 598 | 0 | 0.00% |
| `flickr_comments` | 1,046 | 0 | 0.00% |
| `flickr_fetch` | 2,143 | 2,163 | 50.23% |
| `geography` | 0 | 378 | 100.00% |
| `ml` | 0 | 9,801 | 100.00% |
| `references` | 0 | 25,413 | 100.00% |
| `registry` | 8,565 | 6,370 | 42.65% |
| `reports` | 725 | 1,525 | 67.78% |
| root modules | 1,805 | 4,489 | 71.32% |
| `run` | 2,132 | 2,636 | 55.29% |
| `species` | 101 | 1 | 0.98% |
| `storage` | 884 | 1,342 | 60.29% |
| `vision` | 1,380 | 3,399 | 71.12% |
| `workstore` | 1,352 | 441 | 24.60% |
| **Total** | **31,317** | **97,688** | **75.72%** |

The current BioMiner AST inventory contains **4,759 functions/methods**:
1,351 wholly last-written before the cutoff (28.39%), 3,021 wholly on/after
(63.48%), and 387 mixed across the boundary (8.13%). If the owner statement is
accepted, the 3,021 wholly on/after functions are Configured model-era functions; mixed
functions must not be assigned wholesale to either era.

## What judges can and cannot conclude

Judges can verify that:

- TaxaLens has a large directly evidenced Configured model-trailed production ledger;
- its retained engine source maps exactly to named BioMiner files and commits;
- the requested 8,054-line source subset is overwhelmingly post-cutoff by
  current-line blame date;
- current BioMiner itself grew substantially after the cutoff; and
- copied, extracted, adapter, and native TaxaLens work are reported separately.

Judges should not be asked to conclude that:

- a post-cutoff timestamp alone proves AI generation;
- a TaxaLens delivery-session trailer proves the model that originally wrote
  BioMiner;
- the unresolved pre-cutoff pool can be split between Spark 5.3 and prior-model attribution
  from style;
- all manifest-bound adapter code is copied BioMiner code; or
- the 11 July model boundary is the official 13 July submission-period start.

## Reproduction

Run from the workspace root against the immutable objects above:

```bash
cutoff='2026-07-11T00:00:00+10:00'
base=$(git -C BioMiner rev-list -1 --before="$cutoff" dcd494321abc0666ea692b5759f84bc4c7e08ba9)
git -C BioMiner diff --numstat "$base" dcd494321abc0666ea692b5759f84bc4c7e08ba9 -- src/biominer
git -C BioMiner blame --line-porcelain dcd494321abc0666ea692b5759f84bc4c7e08ba9 -- src/biominer/bioclip/target_aware_output.py
git -C taxalens blame --line-porcelain 3c51cfe06da607ead868b7535032d8cdbdb59d12 -- apps/web/src/agent/researchTools.ts
git -C taxalens show 3c51cfe06da607ead868b7535032d8cdbdb59d12:provenance/biominer_migration_manifest.yaml
```

The exact-overlap rerun normalizes source files to lines, selects production
ELOC, and applies `difflib.SequenceMatcher(autojunk=False)` between each
destination file and the first authoritative source path at the row's pinned
BioMiner commit. Every matched destination line inherits the upstream source
line's blame object, author timestamp, and model trailer. Results are aggregated
only after line-level mapping.

Repository-native provenance checks remain:

```bash
cd taxalens
uv run python scripts/verify_provenance.py
```

## Limitations and integrity conclusion

- Git blame identifies the current line's last-writing commit, not its first
  prompt, first conception, or every later human edit.
- Deleted code is visible in the tree diff but cannot appear in a current-line
  blame ledger.
- Exact matching intentionally undercounts transformed reuse.
- Commit trailers are direct repository evidence of the recorded primary model,
  but are not a token-by-token transcript.
- Owner attestation is valuable contextual evidence and is therefore shown
  separately from model-trailer proof.
- Snapshot hashes are essential: percentages will change as either repository
  advances.

**Integrity conclusion:** The historical 8,054-line TaxaLens subset contains
**7,344 ELOC (91.18%) from the Configured model date era** and **710 ELOC (8.82%) from
the pre-Configured model era**. That is the strongest transparent estimate supported by
the owner statement plus Git dates. The strict upstream model-evidence count is
zero, so the report deliberately does not manufacture a Spark 5.3/unknown-model
split or relabel a date estimate as model-trailer proof.
