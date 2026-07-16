# TaxaLens Judge Guide

## Start here

The supported scored route is the public static replay:

<https://karikris.github.io/taxalens/>

It requires no installation, login, Flickr key, OpenAI key, Supabase account, Backblaze account,
GPU, model download, or BioMiner checkout. Select **Reset replay** before starting, then choose
**Start 90-second judge tour**.

The local equivalent is:

```bash
uv run taxalens demo replay --open
```

The local command validates the fixture and checksums, creates and verifies the production build,
binds only to `127.0.0.1`, waits for HTTP readiness, prints the source SHAs and bundle ID, and then
opens the browser. If locked web dependencies are absent, its first preparation can contact the npm
registry; once the replay is ready, the scientific product route reads only same-origin committed
assets and makes no live scientific or model request.

## Scope and promise

| Question | Judge answer |
| --- | --- |
| What is the product? | An auditable research workflow over social-media biodiversity evidence |
| What is the pilot? | One *Papilio demoleus* metadata-only butterfly replay |
| Does it identify the species in the candidate photo? | No; the hero is `awaiting_human_review` |
| Does GPT-5.6 run live? | No; the judge path replays one stored structured output |
| Does BioMiner run live? | No; TaxaLens reads a bounded checksum-verified artifact import |
| Is a backend required? | No; the hosted product is static |
| Can it be reset? | Yes; **Reset replay** clears client state and returns to Research Mission |
| Is this Phase 14 scientific evaluation? | No; reviewed precision, recall, calibration, and accuracy are unavailable |

Stop the evaluation and record a replay failure if the product asks for a credential, contacts an
unexpected cross-origin scientific service, displays a scientific result after fixture verification
fails, silently changes the target or counts, or presents unavailable evidence as a measured zero.

## 90-second route

### 0–15 seconds — Research Mission

1. Start the tour and choose **Visit Research Mission**.
2. Confirm *Papilio demoleus* and `gbif:1938069`.
3. Confirm replay mode, the pinned registry, bounded plan, and the not-approved live-work state.

Expected: plan generation is deterministic and OpenAI-independent. If you select **Generate
deterministic plan**, a SHA-256 plan fingerprint appears; **Launch submitted replay** can only open
the verified fixture and cannot launch acquisition or inference.

### 15–35 seconds — Observatory

1. Resume the tour, advance to Observatory, and choose **Visit Observatory**.
2. Confirm **24 / 24 verified** and all 13 ordered evidence stages.
3. Select **Final replay record awaiting review**.

Expected: all 13 contributing stages and 12 contributing artifacts highlight. Counts retain their
own units, and unavailable stages do not become zero-valued scientific results.

### 35–60 seconds — Evidence Lens

1. Resume, advance, and visit Evidence Lens.
2. Choose **Inspect verified discovery record**.
3. Switch the full-frame mode to **Masked full frame**.
4. Find *Papilio memnon*, geographic uncertainty, and the decision state.

Expected: source `flickr:55081300254` has two query associations. The masked mode says crossfade is
unavailable because no transformed image exists. *Papilio memnon* is a planning alternative, the
best regional competitor remains unavailable, geographic uncertainty is unavailable in metres, and
the calibrated output is unavailable. The page states **No scientific result is promoted**.

### 60–80 seconds — Dashboard

1. Resume, advance, and visit Dashboard.
2. Scan the evidence funnel, candidate workload, review priority, query yield, efficiency, and
   reviewed-evaluation state.

Expected: the dashboard labels its verified local data boundary. It shows candidate workload rather
than occurrences, refuses conversion rates across unlike units, and leaves reviewed scientific
metrics unavailable.

### 80–90 seconds — Export

1. Resume, advance to Export, and choose **Visit Export**.
2. Confirm focus moves to **Export research outputs**.
3. Choose **Prepare five research outputs**.

Expected: five files are prepared locally with deterministic checksums. The evaluation report has
zero committed reviewed metrics, Phase 14 status `blocked`, a human-verified shortfall of 490, seven
unavailable metric values, and `scientificClaimAllowed: false`.

Use **Replay 90-second judge tour** to repeat the route or **Reset replay** to restore all initial
client state.

## Expected counts and visible states

| Evidence | Expected value |
| --- | ---: |
| Inventoried and verified artifacts | 24 |
| Bundle sections | 20 |
| Unavailable sections | 6 |
| Section records | 29 |
| Media items | 0 |
| Guided-tour steps | 5 |
| Observatory stages | 13 |
| DuckDB-Wasm replay operations | 8 |
| Regional candidate plans | 5 |
| Stored GPT-5.6 traces | 1 |
| Stored response turns / tool calls | 2 / 1 |
| Initial agent-evaluation cases / named checks | 19 / 151 |
| Local research outputs | 5 |
| Committed reviewed scientific metrics | 0 |

The main workload counts are 76,485 many-to-many Flickr query-hit associations, 13,501 canonical
source-photo records, 838 eligible source-media candidates, and zero human-verified source media.
These are discovery and review-workload facts, not biological occurrence or classifier-accuracy
facts.

## Technical route

### 1. Verify the closed fixture

```bash
uv run --locked python scripts/verify_demo.py
```

Expected terminal receipt:

```text
Truthful demo verification passed: bundle=papilio-demoleus-pilot-75461d9c-v1, artifacts=24, records=29, media=0, hero=awaiting_human_review.
```

The verifier rejects undeclared, missing, changed, stale, or semantically inconsistent fixture
content. Do not bypass it or substitute another fixture.

### 2. Inspect provenance and rights

Open [`demo/fixture/papilio_pilot/judge_bundle.json`](demo/fixture/papilio_pilot/judge_bundle.json)
and verify:

- schema `taxalens-judge-bundle:v1.0.0`;
- inventory checksum `02fe3eda46b4e4d41ac07a58d2ef8c3d1691061f784e18032e7b6cb737731f43`;
- payload root `cc9fb1fbbc6c9131bc3f33459ee57d390328899f91a931891e6369dfd468cac2`;
- all 24 artifacts are rights-covered and attribution-complete;
- media-rights verification is false because the fixture contains zero media, not because rights
  were assumed vacuously.

Then run:

```bash
uv run --locked python scripts/verify_provenance.py
```

### 3. Execute the real browser analytics

In Observatory select **Run verified analytics**. The browser loads DuckDB-Wasm locally and performs
eight real operations over committed Parquet and JSON evidence:

1. physical-query deduplication;
2. logical-association fan-back;
3. source-ID hash joins;
4. duplicate anti-joins;
5. spatial-cluster joins;
6. candidate-set union;
7. stage aggregation;
8. evidence assembly.

Engineering mode exposes keys, cardinality, rows, nulls, elapsed time, bytes, artifacts, checksums,
and an inspectable DuckDB `EXPLAIN` plan. A matrix score is never called a hash join.

### 4. Inspect the stored GPT-5.6 trace

Open **Agent Trace** and confirm:

- model `gpt-5.6-sol` with medium standard reasoning;
- **Stored output · no live call**;
- two stored response turns and one `resolve_taxon` tool call;
- citation to `query-definitions`;
- `unsupportedClaimsRejected: true` and `scientificClaimAllowed: false`;
- no chain-of-thought, raw Responses items, token estimate, credential, or live-call simulation.

The stored tool result is re-executed locally and must exactly equal the committed result before it
is displayed.

### 5. Run the coherent browser contract

```bash
cd apps/web
npx playwright test e2e/judge-replay.spec.ts
```

The test actively aborts any HTTP request outside the static replay origin and covers the complete
route through a parsed downloaded evaluation report.

### 6. Verify the hosted artifact

Open
[`build-fingerprint.json`](https://karikris.github.io/taxalens/build-fingerprint.json) and confirm:

- `source_sha` is the exact deployed TaxaLens commit;
- `base_path` is `/taxalens/`;
- public is true;
- login, backend, and credentials required are false;
- resettable is true;
- `files` contains 49 sorted regular-file receipts;
- `build_fingerprint_sha256` is present.

The exact source and root fingerprint change on every `main` deployment. The manifest values, not a
copied screenshot or stale guide value, are authoritative.

## Versions and provenance

| Component | Exact version or revision | Judge interpretation |
| --- | --- | --- |
| TaxaLens hosted source | Live `build-fingerprint.json` `source_sha` | Current static product source |
| Fixture TaxaLens source | `77cd51e7a61945ffef9f0603b9ecd960460abaa9` | Commit that assembled the current fixture lineage |
| BioMiner source | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` | Pinned upstream evidence source; no runtime launch |
| Approved AGENTS.md | SHA-256 `39d8bf1df80402d0cfb135d1093618b120f288f525a516196c3ceb6f3eb04ccb` | Product and evidence policy baseline |
| Judge bundle | `papilio-demoleus-pilot-75461d9c-v1` | Supported replay fixture |
| Source registry | `butterflies-v2-20260712` | Registry contract displayed in Mission |
| Source snapshot | `gbif-reference-search-20260715` | Reference-search planning snapshot |
| Research analyst | `gpt-5.6-sol` | Stored by default; server-only live contract |
| OpenAI JavaScript SDK | `6.47.0` | Server transport dependency; absent from the live judge route |
| DuckDB-Wasm | `1.32.0` | Same-origin local Parquet analytics |
| React | `19.2.7` | Static judge product |
| BioCLIP | 2.5 upstream contract | Zero images processed in this fixture |
| YOLOE | result/model version unavailable | Zero images processed; no detection artifact or weights are claimed |

Primary provenance is recorded in [`UPSTREAM_BIOMINER.md`](UPSTREAM_BIOMINER.md),
[`provenance/biominer_migration_manifest.yaml`](provenance/biominer_migration_manifest.yaml),
[`provenance/githits.jsonl`](provenance/githits.jsonl),
[`submission/AI_CODE_PROVENANCE_REPORT.md`](submission/AI_CODE_PROVENANCE_REPORT.md), and the
immutable [`docs/reports`](docs/reports/) phase reports.

## TaxaLens / BioMiner boundary

BioMiner is the evidence engine. It owns registry construction, Flickr metadata acquisition,
deduplication, YOLOE routing, BioCLIP screening, reference workflows, and the unfinished reviewed
scientific-evaluation path. Its screening output is evidence, never taxonomic validation; missing
geography is unknown, never biological absence.

TaxaLens is the product, replay, planning, analytics, audit, GPT-5.6 explanation, dashboard, export,
and judge surface. It consumes only the pinned committed artifacts and narrowly documented replay
contracts. It does not require, modify, or launch the BioMiner repository during judging.

## Optional live path — not part of this product slice

There is no supported live judge command in this slice.

- The repository contains a server-only, transport-injected GPT-5.6 analyst contract, but no
  production server route, secret-store integration, approval workflow, or live-model E2E test.
- Live Flickr acquisition, licensed media download, YOLOE, BioCLIP, calibration, and reviewed Phase
  14 evaluation remain BioMiner work and require a separate approved environment.
- The future vision commands named as targets in `AGENTS.md` are not implemented TaxaLens judge
  commands and must not be substituted into the scored replay.

Any future live demonstration must have explicit maintainer approval, separate server-side
credentials, bounded budgets, fresh provenance, rights-cleared inputs, and an unmistakable **live**
label. It must never replace or mutate the deterministic fixture expectations above.

## Honest limitations

- The pilot covers one target and one stored analyst session.
- The fixture contains no rights-cleared image or thumbnail.
- No pilot image was processed by YOLOE or BioCLIP for this product slice.
- Full-frame transformation identity, embeddings, reuse receipts, target/competitor scores,
  calibration, abstention evidence, strongest-competitor rank, and reviewed labels are unavailable.
- Geographic data describes candidate workload and planning evidence, not confirmed occurrences.
- Source-media candidates remain unverified support leads with a 247-item sourcing shortfall and a
  490-item human-verification shortfall.
- The 19-case agent evaluation tests deterministic workflow and policy behaviour, not live GPT-5.6
  answer quality or biodiversity accuracy.
- The build and artifact fingerprints are checksum-bearing but not cryptographically signed.

## Troubleshooting

| Symptom | Judge action |
| --- | --- |
| Hosted root does not load | Open `build-fingerprint.json`; record the source SHA and Pages status, then use the local command without changing the fixture |
| Local command stops at verification | Treat it as fail-closed; run `scripts/verify_demo.py` and inspect the reported artifact instead of bypassing the check |
| Counts differ | Select **Reset replay**, confirm the bundle ID and source SHAs, and compare against the expected-count table |
| DuckDB analytics fail | Record the browser error and same-origin extension state; do not replace the eight operations with fabricated results |
| A credential prompt appears | Stop; the supported judge route is credential-free |
| An unexpected cross-origin scientific request appears | Stop and record the URL; the deterministic route should use same-origin assets only |
| A score, probability, or species decision appears | Confirm its artifact citation; without a committed result artifact, treat the display as a product failure |
| An unknown hosted path returns 404 | Follow the static fallback link to `/taxalens/`; the 404 status before redirect is expected |

## Acceptance checklist

- [ ] Public hosted replay opened without login or installation.
- [ ] Target, bundle ID, TaxaLens source, and BioMiner source were visible.
- [ ] Five-step route completed and reset worked.
- [ ] Observatory showed 24 / 24 verified artifacts and 13 stages.
- [ ] One record highlighted 13 stages and 12 artifacts.
- [ ] Evidence Lens kept transformed media, scores, competitor rank, uncertainty, and calibration
      unavailable.
- [ ] Dashboard did not promote workload into an occurrence or reviewed result.
- [ ] Five outputs were prepared and the evaluation report remained non-scientific.
- [ ] Agent Trace was visibly stored, cited, bounded, and credential-free.
- [ ] Technical fixture, provenance, rights, and deployment fingerprint checks passed.
- [ ] Optional live work remained disabled and separate.
- [ ] Limitations were disclosed without a Phase 14 or accuracy claim.
