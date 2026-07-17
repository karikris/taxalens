# TaxaLens Judge Guide

## Start here

The supported scored route is the public static replay:

<https://karikris.github.io/taxalens/>

It requires no installation, login, Flickr key, OpenAI key, Supabase account, Backblaze account,
GPU, model download, or BioMiner checkout. Select **Reset replay** before starting. The route below
uses the numbered primary navigation so every verification step remains visible.

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
| What is the pilot? | One *Papilio demoleus* replay with aggregate prototype evidence and no public image |
| Does it identify the species in the candidate photo? | No; the hero is `awaiting_human_review` |
| Does GPT-5.6 run live? | No; the judge path replays one stored structured output |
| Does BioMiner run live? | No; TaxaLens reads a bounded checksum-verified artifact import |
| Is a backend required? | No; the hosted product is static |
| Can it be reset? | Yes; **Reset replay** clears client state and returns to Research Mission |
| Is Phase 14 evidence present? | Yes, as an aggregate prototype-only snapshot; independently reviewed precision, recall, calibration, and accuracy remain unavailable |
| What did Phase 15 authorize? | `GO_PROTOTYPE_ONLY` for explicit prototype mode; no production default, scientific release, public reference images, or scientific claim |

Stop the evaluation and record a replay failure if the product asks for a credential, contacts an
unexpected cross-origin scientific service, displays a scientific result after fixture verification
fails, silently changes the target or counts, or presents unavailable evidence as a measured zero.

## 90-second route

### 0–12 seconds — 1. Mission

1. Open **01 Mission**.
2. Confirm *Papilio demoleus* and `gbif:1938069`.
3. Scan the human-verification plan: 80 decisions, a 40-owner Flickr sample, two reviewer labels, a
   ±20-point planning objective, and human review required before reference support use.

Expected: all five controls enter deterministic evidence-plan v1.1. The precision number is an
objective, not an observed interval; reviewer labels are not proof of independent identity.

### 12–28 seconds — 2. Evidence Lens

1. Open **03 Evidence Lens**.
2. Choose **Inspect verified discovery record**.
3. Find source `flickr:55081300254` and choose **Verify this result**.

Expected: the source has two query associations but remains a candidate. Current local consensus,
quality contribution, reference state, and event lineage are visible. No scientific result is
promoted.

### 28–42 seconds — 3. Verify the Flickr result boundary

1. Confirm **Exact Flickr result cannot be viewed yet**.
2. Note that the routed Flickr source has no committed checksum-verified review image.
3. Use **Flickr Results** only to inspect its retained route and withheld blind-review context, then
   return to **Reference Images**.

Expected: TaxaLens performs the verification handoff but refuses Yes, No, or Can’t tell for the
unviewable Flickr source. The actionable Commons fixture below is explicitly separate and cannot
verify the Flickr result.

### 42–58 seconds — 4. Check GBIF/iNaturalist reference readiness

1. In **Reference Images**, select **GBIF**, then **iNaturalist**.
2. Confirm each public route contains zero displayable items.
3. Return to **All**, choose **Prepare review cache**, and record one decision on the displayed,
   CC-licensed Commons workflow fixture. An optional comment may be added.

Expected: the private 24-item GBIF/iNaturalist reference packet is ready for assigned review but is
not published as a completed result. Reference readiness remains 0 / 24 independently reviewed.
BioMiner’s 81 / 81 user-confirmed prototype-role suitability receipt is acknowledged as context,
not taxonomic verification. The Commons action exercises the product and changes only local
workflow coverage.

### 58–70 seconds — 5. Watch quality update

1. Open **05 Dashboard**.
2. Read **Decisive coverage**, **Reference readiness**, **Conflicts**, **Quality interval**, and
   **Next review milestone**.

Expected after one decisive Commons choice: decisive coverage changes from 0 / 82 to 1 / 82
campaign assignments. Reference readiness remains blocked, and the target-precision interval
remains **Unavailable** because there are zero inclusion-weighted decisive Flickr audit outcomes.
The first quality checkpoint is 20.

### 70–82 seconds — 6. Ask GPT-5.6 for the next action

1. Open **06 Agent Trace**.
2. Find **GPT-5.6 next review action**.
3. Confirm the stored recommendation is **adjudication** for one intentionally conflicted control
   item and inspect its artifact IDs.

Expected: five read-only tool calls and six stored response turns replay locally with no credential
or live request. The card says **Synthetic evaluation evidence · not current browser state**. It
demonstrates bounded recommendation logic and predicts no quality, taxonomic, or release outcome.

### 82–90 seconds — 7. Export

1. Return to **05 Dashboard** and find **Export research outputs**.
2. Choose **Prepare six research outputs**.

Expected: six deterministic local files receive checksums. The evaluation and prototype-boundary
exports preserve unavailable quality, `GO_PROTOTYPE_ONLY`, and `scientificClaimAllowed: false`.

Use **Reset replay** to clear local state and restore Mission. The built-in guided tour remains
available as a slower orientation route.

## Expected counts and visible states

| Evidence | Expected value |
| --- | ---: |
| Inventoried and verified artifacts | 30 |
| Bundle sections | 25 |
| Unavailable sections | 8 |
| Section records | 36 |
| Media items | 3 |
| Guided-tour steps | 6 |
| Verification campaign assignments / public cache images | 82 / 3 |
| Public Commons / private Flickr / private reference / control items | 3 / 49 / 24 / 6 |
| Observatory stages | 13 |
| DuckDB-Wasm replay operations | 8 |
| Regional candidate plans | 5 |
| Stored GPT-5.6 traces | 2 |
| Research replay response turns / tool calls | 2 / 1 |
| Verification replay response turns / tool calls | 6 / 5 |
| Deterministic evaluation cases / named checks | 31 / 247 |
| Local research outputs | 6 |
| Committed reviewed scientific metrics | 0 |
| Prototype-entry gates passed / required | 14 / 14 |
| Prototype support rows / independently human-verified | 81 / 0 |
| Prototype-role suitability user-confirmed | 81 / 81 |

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
Truthful demo verification passed: bundle=papilio-demoleus-prototype-74a7d648-v3, artifacts=30, records=36, media=3, hero=awaiting_human_review.
```

The verifier rejects undeclared, missing, changed, stale, or semantically inconsistent fixture
content. Verification media also fails closed when campaign, item, rights, attribution, hash, byte
count, media type, path, or bounded use-scope relationships disagree. Do not bypass it or
substitute another fixture.

### 2. Inspect provenance and rights

Open [`demo/fixture/papilio_pilot/judge_bundle.json`](demo/fixture/papilio_pilot/judge_bundle.json)
and verify:

- schema `taxalens-judge-bundle:v1.0.0`;
- inventory checksum `7bbb1c9f28d23e5b87abc8c6139182fff683c2ae4873f5bc2a17fe91b0784acc`;
- payload root `9e6b4660d7d6ea885c0a231cca63e7237bf59cc8a8c4eae84a2f3fd701124974`;
- all 30 artifacts are rights-covered and attribution-complete;
- media-rights verification covers three CC BY-SA 4.0 Commons review images, while their
  provider-supplied taxonomic identities remain unreviewed.

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

### 4. Inspect the stored GPT-5.6 traces

Open **Agent Trace** and confirm:

- the research analyst uses model `gpt-5.6-sol` with medium standard reasoning;
- both panels say **Stored output · no live call**;
- the research trace contains two stored response turns, one `resolve_taxon` tool call, and a
  citation to `query-definitions`;
- the verification trace contains six stored response turns and five read-only tool calls;
- the verification recommendation is adjudication for an intentionally conflicted synthetic
  control item;
- the verification card says **Synthetic evaluation evidence · not current browser state**;
- `unsupportedClaimsRejected: true` and `scientificClaimAllowed: false` remain visible;
- no chain-of-thought, raw Responses items, token estimate, credential, or live-call simulation.

Stored tool results are validated against committed fixtures before display. Neither panel is a
live prediction or evidence that the current human-review ledger contains the synthetic conflict.

### 5. Exercise the local human-review packet

Open **Verification**, select **Prepare review cache**, and confirm three checksum-verified,
CC BY-SA 4.0 images become available from the static origin. Record a choice using Yes, No,
Can’t tell, Can’t view, or Skip, optionally add a comment, revisit an item to replace its choice,
and export the local receipt. This packet is separate from the non-displayable BioMiner bank. Its
campaign, item, media, rights, and attribution identity comes from the single canonical
[`Papilio demoleus` verification manifest](demo/source/verification/papilio-demoleus-commons.campaign.json).

### 6. Run the coherent browser contract

```bash
cd apps/web
npx playwright test e2e/judge-replay.spec.ts
```

The test actively aborts any HTTP request outside the static replay origin and covers the complete
route through a parsed downloaded evaluation report.

### 7. Verify the hosted artifact

Open
[`build-fingerprint.json`](https://karikris.github.io/taxalens/build-fingerprint.json) and confirm:

- `source_sha` is the exact deployed TaxaLens commit;
- `base_path` is `/taxalens/`;
- public is true;
- login, backend, and credentials required are false;
- resettable is true;
- `files` contains the current sorted regular-file receipts; use its live length rather than a stale copied count;
- `build_fingerprint_sha256` is present.

The exact source and root fingerprint change on every `main` deployment. The manifest values, not a
copied screenshot or stale guide value, are authoritative.

## Versions and provenance

| Component | Exact version or revision | Judge interpretation |
| --- | --- | --- |
| TaxaLens hosted source | Live `build-fingerprint.json` `source_sha` | Current static product source |
| Fixture TaxaLens source | `fab9d3f1605d28d4bbfc3a4d0074f40e5ffff023` | Commit that assembled the current prototype snapshot lineage |
| Fixture BioMiner source | `74a7d648a562efa744e6502ef504a23b63b4e02f` | Immutable source pinned by the judge bundle; includes the 81 / 81 user-goal suitability receipt |
| Current BioMiner planning source | `94fa1f634ee3c63917c05d78181dd3cf9ceff940` | Newer upstream repository state acknowledged for workflow planning; not silently substituted into the immutable fixture |
| Approved AGENTS.md | SHA-256 `39d8bf1df80402d0cfb135d1093618b120f288f525a516196c3ceb6f3eb04ccb` | Product and evidence policy baseline |
| Judge bundle | `papilio-demoleus-prototype-74a7d648-v3` | Supported replay fixture |
| Source registry | `butterflies-v2-20260712` | Registry contract displayed in Mission |
| Source snapshot | `gbif-reference-search-20260715` | Reference-search planning snapshot |
| Research analyst | `gpt-5.6-sol` | Stored by default; server-only live contract |
| OpenAI JavaScript SDK | `6.47.0` | Server transport dependency; absent from the live judge route |
| DuckDB-Wasm | `1.32.0` | Same-origin local Parquet analytics |
| React | `19.2.7` | Static judge product |
| BioCLIP | `imageomics/bioclip-2.5-vith14` at `191d741545e4c741cdef4b22c6eb69c945c1e592` | Aggregate prototype metadata records 81 frozen support embeddings; no image bytes or hero embedding are included |
| YOLOE | `yoloe26:yoloe-26s-seg` | Aggregate router metadata only; no hero detection artifact or classification authority |

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
- Live Flickr acquisition, licensed media download, new YOLOE/BioCLIP execution, calibration, and
  independently reviewed scientific evaluation remain BioMiner work and require a separate approved
  environment.
- The future vision commands named as targets in `AGENTS.md` are not implemented TaxaLens judge
  commands and must not be substituted into the scored replay.

Any future live demonstration must have explicit maintainer approval, separate server-side
credentials, bounded budgets, fresh provenance, rights-cleared inputs, and an unmistakable **live**
label. It must never replace or mutate the deterministic fixture expectations above.

## Honest limitations

- The pilot covers one target and two stored analyst traces.
- The fixture contains three rights-cleared Commons images only for the human-verification
  workflow; none is admitted as scientific evidence or as the hero record's image.
- The aggregate prototype snapshot records upstream YOLOE/BioCLIP execution, but the fixture
  contains no image bytes and no detector, embedding, or score payload for the hero record.
- Full-frame transformation identity, embeddings, reuse receipts, target/competitor scores,
  calibration, abstention evidence, strongest-competitor rank, and reviewed labels are unavailable.
- Geographic data describes candidate workload and planning evidence, not confirmed occurrences.
- Source-media candidates remain unverified support leads with a 247-item sourcing shortfall and a
  490-item human-verification shortfall.
- The 31-case agent evaluation tests deterministic workflow and policy behaviour, not live GPT-5.6
  answer quality or biodiversity accuracy.
- Browser E2E requires the Playwright host libraries. Local Chromium results are recorded by the
  release gate; Firefox, WebKit, and CI remain separate browser environments and must not be
  inferred from a Chromium pass.
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
- [ ] Seven-step route completed and reset worked.
- [ ] Observatory showed 30 / 30 verified artifacts and 13 stages.
- [ ] One record highlighted 13 stages and 12 artifacts.
- [ ] Evidence Lens kept transformed media, scores, competitor rank, uncertainty, and calibration
      unavailable.
- [ ] The exact Flickr route stayed unviewable and the separate Commons fixture was not presented
      as verification of that Flickr source.
- [ ] GBIF/iNaturalist public review remained 0 / 24 independently reviewed.
- [ ] Dashboard did not promote workload into an occurrence or reviewed result.
- [ ] Quality stayed unavailable until inclusion-weighted decisive Flickr audit outcomes exist.
- [ ] Six outputs were prepared, the prototype receipt stayed prototype-only, and the evaluation
      report remained non-scientific.
- [ ] Agent Trace was visibly stored, cited, bounded, and credential-free; its verification
      recommendation remained labelled synthetic evaluation evidence.
- [ ] Technical fixture, provenance, rights, and deployment fingerprint checks passed.
- [ ] Optional live work remained disabled and separate.
- [ ] Limitations were disclosed without promoting Phase 14 prototype evidence into an accuracy or
      scientific-release claim.
