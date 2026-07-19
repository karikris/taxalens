# TaxaLens first product slice

**Report date:** 2026-07-16
**Goal status:** complete for the credential-free research-operations product slice; blocked for
scientific validation and live operation.

## Completion decision

TaxaLens has advanced from a tested collection of migrated BioMiner contracts into one coherent,
public, resettable product experience. A judge can open Research Mission, follow the evidence
pipeline, inspect one record and its uncertainty, analyse the committed artifacts in the browser,
review the research workload, inspect a stored Configured model tool trace, and export deterministic evidence
without a login, key, backend, GPU, model download, or live third-party service.

This completion decision applies to the product slice only. It is not a claim that *Papilio
demoleus* was identified in a candidate image, that a Flickr candidate is a biological occurrence,
that the reference bank is reviewed, or that Phase 14 scientific evaluation succeeded.

## Repository identity

| Boundary | Exact value | Evidence |
| --- | --- | --- |
| TaxaLens starting SHA | `3b4e64ef724415845f1b6dbef45fe5ce1db56669` | Last inspected pre-goal implementation: selective-decision policy, 533 tests, no product slice |
| Product implementation ending SHA | `0c8f941aecd63235f6c3af5eda7df80337ae82a0` | Task 10.2 Judge Guide commit immediately before this report |
| Product implementation pushed SHA | `0c8f941aecd63235f6c3af5eda7df80337ae82a0` | `main` and remote `main` matched at report authoring |
| Commits after starting SHA | 66 | `3b4e64e…0c8f941` Git range |
| Branch | `main` | Explicit user-directed direct-main workflow recorded since Phase 0 |
| Approved `AGENTS.md` SHA-256 | `39d8bf1df80402d0cfb135d1093618b120f288f525a516196c3ceb6f3eb04ccb` | Direct SHA-256 verification |
| Primary Codex model | `configured-model` | Required commit trailers and OpenAI implementation contract |
| Reasoning effort / mode | `high` / `standard` | Required commit trailers |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` | Required commit trailers |
| GitHits numbered-task coverage | 53 of 53 | `provenance/githits.jsonl`, Tasks 0.1 through 10.3 |

The Task 10.3 commit that contains this report cannot include its own SHA without changing that SHA.
Its exact commit and pushed SHA are therefore recorded by Git history and the Phase 10 completion
report. The ending and pushed values above are the last observed product implementation boundary,
not a self-referential placeholder.

## BioMiner SHAs consumed

| BioMiner SHA | Consumed scope | Boundary |
| --- | --- | --- |
| `1535c494f9403e22ed9b163f3ae0ce3706e17f4c` | Existing target-aware output, storage, non-match, detection, full-frame, fusion, run, stage, geography, reference, and review contracts | Mechanically preserved or thinly extracted components declared in the migration manifest |
| `0561906d994d6b9e56e0b6405fdb68272759595f` | Selective-decision policy present at the product-slice starting SHA | Complete calibrated-abstention and competitor-margin policy contract; no calibrator artifact claimed |
| `75461d9c065af0cd96b41cd1f845c2e920f7ae34` | Current Phase 13/14 metadata and storage-handoff audit, committed Papilio artifacts, and final pinned boundary | Artifact-first handoff source; BioMiner runtime is not launched by TaxaLens |

BioMiner comparison baseline `98ba9ca1c0af89396263455af31d4c22c04a07d9` is used only by the historical
AI cutoff audit and is not reported as a consumed product input. BioMiner remained on `main` at the
final pin. Its pre-existing untracked local configuration, documentation, query-term, and log paths
were never staged, modified, or imported.

No broad BioMiner module copy was added after the product boundary froze. Later work used committed
artifacts, versioned schemas, the TaxaLens facade, and TaxaLens-native UI, analytics, agent,
verification, and deployment code.

## Judge bundle integrity

| Field | Exact value |
| --- | --- |
| Bundle ID | `papilio-demoleus-pilot-75461d9c-v1` |
| Schema | `taxalens-judge-bundle:v1.0.0` |
| Fixture TaxaLens SHA | `77cd51e7a61945ffef9f0603b9ecd960460abaa9` |
| BioMiner SHA | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| Inventory SHA-256 | `02fe3eda46b4e4d41ac07a58d2ef8c3d1691061f784e18032e7b6cb737731f43` |
| Payload-root SHA-256 | `cc9fb1fbbc6c9131bc3f33459ee57d390328899f91a931891e6369dfd468cac2` |
| Inventoried artifacts | 24 |
| Sections / section records | 20 / 29 |
| Unavailable sections | 6 |
| Media items | 0 |
| Hero | one `awaiting_human_review` candidate |
| Attribution entries | 2, complete across all artifacts |
| Rights state | all artifacts covered; metadata licences checked; media rights not asserted because no media is included |

The bundle uses committed BioMiner metadata and real Parquet artifacts. It contains no synthetic
scientific result, reference image, detector output, transformed frame, embedding, calibrated
decision, or reviewed label. Missing evidence is represented structurally as unavailable.

## Completed product screens and flows

| Product surface | Completed acceptance evidence |
| --- | --- |
| Research Mission | Configures target, region, retrieval policy, candidate policy, reference policy, evidence strictness, budget, replay mode, and optional device; generates the same structured plan and SHA-256 fingerprint without OpenAI; launches only the verified fixture |
| Evidence Observatory | Renders all 13 evidence stages; executes eight real DuckDB-Wasm operations; separates Research and Engineering inspection; shows only measured avoided work; highlights 13 contributing stages and 12 artifacts for the hero record |
| Evidence Lens | Shows many-to-many discovery provenance, explicit YOLOE route absence, full-frame input contracts, five regional candidate plans, selective-decision blockers, geography/reference context, lifecycle ledger, and five-file audit export without inventing media or scores |
| Butterfly Dashboard | Shows the evidence funnel, 76-cluster candidate workload, review priority boundary, query yield, measured versus unavailable efficiency, blocked reviewed evaluation, and five deterministic research outputs |
| Agent Trace | Makes exact `configured-model`, bounded tools, artifact citations, public structured output, budgets, and stored no-live-call state visible without hidden reasoning or browser credentials |
| Guided judge route | Provides exactly five timed steps totalling 90 seconds, with skip, previous, reset, finish, completion, and replay; Export focuses the research-output panel |
| Hosted and local replay | Public Pages route and one-command loopback route both serve the same production client and verified fixture; reset is client-local and reproducible |

The primary four requested screens are complete. Agent Trace, guided tour, export focus, and static
deployment are additional product surfaces needed to make the slice judgeable.

## Replay commands

Supported local judge replay:

```bash
uv run taxalens demo replay --open
```

The command verifies fixture semantics and checksums, builds and verifies the static web product,
serves only `dist/web` on `127.0.0.1`, waits for readiness, optionally opens the browser, prints
current and fixture TaxaLens SHAs, the pinned BioMiner SHA, bundle ID, expected counts, hero state,
and credential state, and shuts down cleanly.

Supported no-install route:

<https://karikris.github.io/taxalens/>

The public route requires no login, backend, credential, model request, or scientific API. It is
resettable and has a static 404 fallback.

## Agent evaluation

The initial research-workflow evaluator contains 19 deterministic cases and 151 named checks. The
aggregate threshold is `0.95`, every case must score `1.0`, and the committed evaluation scores
`1.0` with all cases passing.

Coverage includes mission planning, why-found and why-unavailable explanations, pending review
versus model abstention, strongest-competitor unavailability, reference shortfalls, candidate versus
occurrence semantics, unavailable embedding reuse, missing geography as unknown, export receipts,
and unsupported target, record, or claim rejection.

The evaluator calls only deterministic evidence tools and the stored public replay. It makes no live
model or scientific request. Its result is evidence about tool, policy, replay, and citation
behaviour; it is not evidence of Configured model answer quality, biodiversity accuracy, calibration, or
human release approval.

## Test and verification matrix

| Gate | Result | Scope |
| --- | --- | --- |
| Python full suite | 634 passed | Replay contracts, product facade, fixture, CLI, imports, verification, boundary scanning, and local server |
| Vitest | 110 passed across 48 files | React product, data facade, analytics models, exports, shell, tour, tools, analyst, stored replay, and agent evaluation |
| Agent evaluation test | 3 tests passed; 19 cases and 151 checks | Deterministic research-workflow threshold and repeatability |
| TypeScript | passed | Strict project references via `npm run check` |
| Playwright | 21 passed | Accessibility, reduced motion, DuckDB, all product views, exports, and one coherent judge journey |
| Production static build | passed | Vite build plus byte-exact verification of 24 fixture artifacts and same-origin DuckDB extension |
| Deployment contract | 3 passed | Public flags, deterministic 404, `.nojekyll`, 49-file fingerprint, tamper rejection, and source-drift rejection |
| Python package build | passed | Source distribution and wheel from locked project metadata |
| Dependency audit | 0 production vulnerabilities | `npm audit --omit=dev` |
| Truthful demo verification | passed | 24 artifacts, 29 records, 0 media, hero awaiting review |
| Rights verification | passed for the metadata-only scope | Complete artifact rights/attribution coverage; zero media; no vacuous media-rights claim |
| Provenance verification | passed | Migration manifest, required files, task records, exact origins, and pinned BioMiner boundary |
| Submission documentation | passed | README, Judge Guide, product-slice report, local links, required judge claims, AI provenance report, and fixture entry point present |
| Hosted smoke | passed | Public root HTTP 200, runtime fingerprint, same static bundle, and redirecting 404 fallback |
| 1280×720 visual audit | passed | Original-resolution capture inspected for hierarchy, legibility, status semantics, navigation, and available controls |
| Whitespace/documentation lint | passed | `git diff --check` plus README/Judge Guide/report link and required-section checks |
| Repository-wide Ruff audit | 268 findings remain | 208 in preserved replay code/tests and 60 in TaxaLens scripts/code/tests; no unrelated or provenance-sensitive sweep was performed |

The repository-wide Ruff result is deliberately reported rather than hidden. Targeted Ruff checks
for changed Python files passed throughout the numbered tasks. The completion audit additionally
repairs `.git` pruning in the BioMiner boundary scanner and covers it with a focused test. The
current locked audit still reports 208 findings under `packages/replay` and 60 under `taxalens`,
`scripts`, and `tests`. They do not change runtime acceptance, but a future lint-baseline and cleanup
decision is required before claiming a globally clean Ruff gate.

## Hosted deployment status

The Task 10.3 Pages run observed during the completion audit completed successfully:

| Field | Verified value |
| --- | --- |
| GitHub Actions run | `29462284845` — build and deploy successful |
| Deployed source | `2dd36573b4df5dcdbbabfa519d901a665ea62d7a` |
| Build fingerprint | `92e2d31bd300c4c9ca4b14b85c4f69d10986ae91e429b81efba3b18b179067c8` |
| Fingerprinted regular files | 49 |
| Base path | `/taxalens/` |
| Public / resettable | true / true |
| Login / backend / credentials required | false / false / false |

The workflow checks out the exact event SHA, uses locked dependencies, tests the deployment
contract, builds and byte-verifies the client, inventories regular files with SHA-256, uploads only
the static directory, and deploys through separate least-privilege jobs. Every later `main` commit,
including this report, produces a new authoritative `source_sha` and root fingerprint; the live
[`build-fingerprint.json`](https://karikris.github.io/taxalens/build-fingerprint.json) is the current
deployment record.

## Provenance and submission status

- All 53 numbered tasks have a focused GitHits record with reviewed repositories, adopted and
  rejected patterns, reason, licence notes, solution status, and a solution ID where GitHits
  returned one.
- Every numbered task has its own conventional commit, exact BioMiner origin, human decision,
  reviewer, tests, model, reasoning, and session disclosures.
- The repository preserves 39 timestamped BioMiner boundary snapshots spanning all three consumed
  upstream pins. Final verification reconfirmed the current pin and its pre-existing untracked
  paths without changing BioMiner.
- [`UPSTREAM_BIOMINER.md`](../../UPSTREAM_BIOMINER.md) and the
  [`migration manifest`](../../provenance/biominer_migration_manifest.yaml) separate copied,
  extracted, adapted, artifact, and TaxaLens-native work.
- [`AI_CODE_PROVENANCE_REPORT.md`](../../submission/AI_CODE_PROVENANCE_REPORT.md) is an auditable
  historical code census at its recorded `8a6fd8d…` snapshot. It is not silently presented as a
  final whole-repository ELOC census after later UI, agent, deployment, and documentation work.
- The current commit trailers and this report provide exact provenance for all later tasks. A fresh
  ELOC census is remaining presentation work if the final submission needs one consolidated number.
- The competition README and Judge Guide are current. Product screenshots, the final deck, and the
  final competition video remain intentionally outside this goal.

## Blocked scientific claims

| Claim intentionally not made | Why it is blocked | Required unblocking evidence |
| --- | --- | --- |
| The candidate is a verified *Papilio demoleus* occurrence | Search and source-media metadata are hypotheses; no rights-cleared reviewed image is committed | Rights-cleared media, attribution, occurrence provenance, qualified identity review, and a committed evidence record |
| YOLOE found a butterfly or produced a valid mask | Zero pilot images were processed and no result artifact exists | Versioned YOLOE route/output artifact tied to source media and exact model/config fingerprint |
| BioCLIP classified the candidate | No fixture image, embedding, target score, or complete regional candidate score set exists | Full-canvas inputs, one-time embeddings, target plus all eligible competitor scores, and immutable evidence fingerprints |
| *Papilio memnon* is the strongest competitor | It is a regional planning hypothesis with no comparable score-derived rank | Complete same-route candidate scoring and verified competitor-evidence artifact |
| A displayed number is a calibrated probability | No committed calibrator or calibration report exists | Frozen calibrator, calibration split, versioned report, and target-aware output artifact |
| The system abstained scientifically | The current record is pending review; model abstention evidence is absent | Complete selective-decision artifact with raw/calibrated evidence and abstention reason |
| Precision, recall, PR-AUC, calibration, or accuracy is known | Zero reviewed evaluation metrics and no leakage-safe final-test result exist | Reviewed gold labels, group-aware split freeze, B0–B16 evidence, selected calibration, and final untouched evaluation |
| Reference support is ready | 838 eligible candidates remain unverified; sourcing shortfall is 247 and human-verification shortfall is 490 | Rights and attribution review, qualified identity review, source completion, and a passing reference-readiness manifest |
| TaxaLens has measured researcher time or cost savings | No controlled productivity or cost ledger is committed | Defined baseline, instrumentation, comparable tasks, and reviewed measurements |
| Build provenance is signed | Checksums are present but no signing key or transparency record is used | Approved signing policy, key custody, signature, and verification path |

## Human work required

1. Review the existing source-media candidates for licence, attribution, image usability, identity,
   life stage, visual domain, and leakage groups; source additional candidates where five groups are
   short.
2. Resolve the 490-item human-verification shortfall and the two unresolved negative groups in the
   BioMiner reference workflow.
3. Freeze leakage-safe train/calibration/final-test groups before model comparison.
4. Run the bounded off-machine YOLOE and frozen BioCLIP evidence pipeline after rights and review
   approval; commit exact artifacts and fingerprints rather than screenshots.
5. Evaluate B0–B16, select calibration without using final-test evidence, run the untouched final
   evaluation, and record reviewed scientific metrics or an explicit abstention.
6. Decide whether to implement a separately approved server route, secret handling, and live-model
   evaluation for Configured model. The credential-free replay must remain the primary judge path.
7. Capture product screenshots and produce the final submission deck and video without changing the
   fixture claims.
8. Refresh the AI code-origin census if a final whole-repository ELOC percentage is required.

## Explicit exclusions

The product-slice completion claim excludes:

- live global Flickr, GBIF, or iNaturalist acquisition;
- production Supabase, Backblaze, queue, or workflow orchestration;
- model downloads, GPU setup, YOLOE/BioCLIP execution, training, and calibration;
- completed Phase 13 reviewed Papilio results or Phase 14 scientific evaluation;
- verified target or competitor reference banks;
- global butterfly coverage;
- measured productivity, performance, or cost optimization;
- a production OpenAI route or live Configured model quality evaluation;
- signed artifacts or a software supply-chain attestation;
- the final deck, screenshots, and competition video.

## Next recommended goal

**Goal:** complete and publish the rights-cleared, human-reviewed Papilio reference tranche for the
target, all five regional competitor hypotheses, and the two negative groups already defined by the
pinned BioMiner planning artifacts.

**Definition of done:** BioMiner publishes a new pinned, checksum-verified handoff with zero required
source and human-review shortfall under the committed reference policy; every retained media item
has rights, attribution, reviewer, identity, life-stage, visual-domain, and leakage-group evidence;
TaxaLens imports the handoff artifact-first and can display one real media-backed hero while still
making no classifier or Phase 14 success claim.

**Why this is next:** human-verified, rights-cleared evidence is the highest dependency shared by the
hero visual, YOLOE/BioCLIP execution, complete competitor scoring, calibration, evaluation, and
scientific claims. Adding more UI or copying more BioMiner code cannot unblock those gates.

**Required proof:** a new BioMiner source SHA, closed handoff inventory, rights and attribution
manifest, review records, shortfall report, leakage-group receipts, updated TaxaLens bundle roots,
rights tests, provenance snapshot, and an unchanged credential-free fallback replay.
