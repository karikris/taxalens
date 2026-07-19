# Geographic Impact completion audit

Date: 2026-07-18 (Australia/Sydney)

Audit task: `geo-impact-11.3`

Audited TaxaLens revision: `16242d1e97b4b7cee6823ed604232ebcc4436daf`

Observed BioMiner `main`: `c7eaa9bf3696a25a0c8229837819dccec4fb9d66`

Consumed BioMiner artifact commits:

- baseline geography: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`;
- Flickr geography: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

## Outcome

The complete 78-item final acceptance matrix is implemented and independently traceable to current
contracts, artifacts, source, tests and the public replay. One residual unsafe label was found during
this audit: an unused design-system variant could render “Human-verified occurrence” without an
occurrence-release decision. Subtask `geo-impact-11.3.2` removes that variant, requires a non-empty
release-gate evidence identity and adds a runtime regression test. Its separate commit follows this
audit commit before the task push.

Technical product completion does not create scientific evidence. The committed campaigns still
contain zero retained human outcomes, zero human-supported additional cells and zero release-ready
occurrence candidates. The usability study also remains `pending_human_data`. Those are explicit,
quality-gated product states rather than fabricated completion claims.

## Evidence catalogue

| ID | Current evidence |
| --- | --- |
| A | Direct-to-main range `e85b0d2..16242d1`: 169 commits, zero merge commits, every commit has all 12 required AI/test/provenance lines; only local branch is `main`; no open pull request. |
| B | `provenance/githits.jsonl`: 37 task records and 134 numbered subtask records after this audit; every Geographic Impact record has queries, repositories, adopted/rejected patterns, reason, licence notes and status. |
| C | `contracts/schemas/geographic/`, `taxalens/product/geographic_contracts.py`, and `packages/contracts/src/geographic_impact_contract.ts`; Python/JSON Schema/TypeScript parity passes. |
| D | Judge bundle v2 contracts, v1 migration, `BundleVerifier`, `BundleLoader`, `TaxaLensProjectFacade`, and `PapilioJudgeFixtureValidator`; the truthful v1 fixture migrates with unavailable sections rather than invented evidence. |
| E | Baseline-union manifest: 19,201 canonical observations, 4,017 GBIF-only, 15,184 iNaturalist-origin through GBIF, direct iNaturalist delta unavailable, zero removed and zero unresolved duplicates. |
| F | Geographic Impact manifest: 13,501 Flickr candidates, 13,416 geographically supported, 20,237 impact cells, 693 baseline-only, 183 matched, 6,764 candidate-only, 385 rollups and zero retained reviewed/release outcomes. |
| G | `geographicImpactAnalytics.ts`: scoped browser registration, real SQL `FULL OUTER JOIN`, projection bounds, engineering metrics, cancellation and semantic query cache. |
| H | `GeographicImpactLens.tsx` and supporting map modules: offline MapLibre, blue baseline, five amber maturity encodings, shared tested bubble scale, slicers, breadcrumbs, synchronized exact table and accessible summaries. |
| I | `geographicContributionMetrics.ts`, materializer and tests: potential, human-supported and release-ready cells/uplift, same-resolution distance, temporal contribution and explicit deficiency states. |
| J | `geographicReviewProjection.ts`, `publicGeographicReviewProjection.ts`, QualitySnapshot and progress panels: append-only local refresh, Skip/Can’t view exclusion, sampling disclosure and independent release gates. |
| K | Evidence Lens geographic context modules: precision-aware mini-map, exact facts, nearby baseline cells, Geographic Impact/cell/Verification actions and baseline provenance. |
| L | Six deterministic geographic analyst tools, stored credential-free `configured-model`/`xhigh` replay and 25-case evaluation with a 1.0 pass rate and no live OpenAI call. |
| M | Current gates: 914 Python passed; 545 Vitest passed and 1 intentional skip; TypeScript and native Ruff passed; browser 67 passed and 1 explicit human-study skip; visual 20 passed; performance 3 passed. |
| N | Network, rights and distribution gates: zero external map requests, Natural Earth/public-domain and dependency licence verification, 73-file static build, npm audit zero, no tracked secret signature and no tracked file above 5 MiB. |
| O | README screenshot/GIF, Judge Guide route, presentation, 32-second hero sequence, Devpost copy and Build Week delta use artifact-backed potential-contribution language. |
| P | Public HTTPS replay was verified at pre-audit source `16242d1`; final task SHA is rechecked after the direct `main` push because a deployed source fingerprint cannot self-reference an unpushed commit. |

## Final acceptance matrix

`Proven` means current executable or repository evidence was inspected and the current gate passed.
`Proven after 11.3.2` identifies the one defect discovered and repaired by this audit.

| # | Acceptance criterion | Status | Evidence |
| ---: | --- | --- | --- |
| 1 | All commits directly on `main` | Proven | A |
| 2 | No goal feature branch created | Proven | A and task push reports; the unrelated historical remote branch is outside the goal range |
| 3 | No pull request opened | Proven | A; GitHub reports no open PR |
| 4 | Every numbered subtask has its own commit | Proven | A/B and per-task reports; later repair commits may cite the originating subtask but do not replace its dedicated commit |
| 5 | `main` pushed after every task | Proven through Task 11.2; Task 11.3 push is this audit’s final gate | A and task reports |
| 6 | No force push | Proven by retained task receipts and uninterrupted remote ancestry | A |
| 7 | Every task has a task-level GitHits record | Proven | B |
| 8 | Every subtask has a focused GitHits record | Proven | B |
| 9 | GitHits licence notes present | Proven | B |
| 10 | No unreviewed external implementation copied | Proven | B and rights reports |
| 11 | Judge bundle v2 exists | Proven | D |
| 12 | v1 fixtures remain loadable | Proven | D/M |
| 13 | Baseline-union contract exists | Proven | C/E |
| 14 | Impact-cell contract exists | Proven | C/F |
| 15 | Impact-summary contract exists | Proven | C/F |
| 16 | Country hierarchy exists | Proven | C/F/N |
| 17 | TypeScript/Python/JSON Schema parity passes | Proven | C/M |
| 18 | Baseline and Flickr use compatible cells | Proven | C/F and handoff verifier |
| 19 | GBIF and iNaturalist are not double counted | Proven | E |
| 20 | Provider relationships remain visible | Proven | E and `baseline_provider_relationships.parquet` |
| 21 | Unresolved duplicates remain explicit | Proven | C/E |
| 22 | Coordinate precision is preserved | Proven | Flickr long-form handoff and precision tests |
| 23 | Source snapshots and SHAs recorded | Proven | E/F |
| 24 | Browser executes a real full-outer cell join | Proven | G/M |
| 25 | Every query is scoped by project, run, taxon and snapshots | Proven | G and query-input tests |
| 26 | No fixed `13_501` product count remains | Proven | Runtime search; remaining values occur only in deterministic fixture/evaluation metadata |
| 27 | Global/continent/country rollups reconcile | Proven | F/M |
| 28 | Engineering metrics expose the join | Proven | G and Observatory tests |
| 29 | Stale queries are cancelled | Proven | G and cancellation tests |
| 30 | Browser memory remains bounded | Proven | G; selected columns, preaggregated rows, bounded features and LRU limits |
| 31 | Existing workload map preserved | Proven | `FlickrWorkloadMap` and legacy semantic tests |
| 32 | Geographic Impact Lens is separate | Proven | H |
| 33 | Baseline is blue | Proven | H and visual regression |
| 34 | Flickr evidence is amber | Proven | H and visual regression |
| 35 | Evidence states use color plus shape/stroke | Proven | H and forced-colors/accessibility tests |
| 36 | Bubble scale is mathematically documented | Proven | shared scale module, tests and required caption |
| 37 | Exact counts appear in tooltips and table | Proven | H |
| 38 | Global drilldown works | Proven | H/M |
| 39 | Continent drilldown works | Proven | H/M |
| 40 | Country drilldown works | Proven | H/M |
| 41 | Breadcrumbs work | Proven | H/M |
| 42 | Slicers work | Proven | H/M |
| 43 | Map and table remain synchronized | Proven | H/M |
| 44 | No external map request occurs | Proven | N/M |
| 45 | Keyboard and screen-reader alternatives exist | Proven | H/M |
| 46 | Candidate-only cells identified | Proven | F/I |
| 47 | Reviewed additional cells identified | Proven as a gated state; current count is zero | F/I/J |
| 48 | Release-ready cells require complete gates | Proven | I/J |
| 49 | Range-edge distance calculated | Proven | I |
| 50 | Temporal contribution calculated | Proven | I |
| 51 | Data-deficiency states explicit | Proven | I |
| 52 | No candidate called a new occurrence | Proven after 11.3.2 | semantic guard, analyst evaluation and repaired designation primitive |
| 53 | Missing baseline never called species absence | Proven | H/I/L |
| 54 | Map reflects pending/reviewed/uncertain/excluded | Proven | H/J and synthetic state tests; retained replay is pending-only |
| 55 | Skip does not count as reviewed | Proven | J/M |
| 56 | Can’t view does not count as reviewed | Proven | J/M |
| 57 | Failure-discovery reviews block unweighted inference | Proven | J and quality tests |
| 58 | QualitySnapshot gates reviewed contribution | Proven | J |
| 59 | Record mini-map links to Verification | Proven | K/M |
| 60 | Review events update local map state | Proven | J/M; local events never create release state |
| 61 | Geographic read-only tools exist | Proven | L |
| 62 | Every analyst answer cites artifacts | Proven | L |
| 63 | Configured model does not calculate novelty from memory | Proven | L |
| 64 | Stored replay remains credential-free | Proven | L |
| 65 | Evaluations reject double counting and overclaims | Proven | L/M |
| 66 | Chromium full journey passes | Proven | M |
| 67 | Firefox smoke passes | Proven | M |
| 68 | WebKit smoke passes | Proven | M |
| 69 | Visual regression exists | Proven | M |
| 70 | No-WebGL and no-WASM states fail clearly | Proven | H/M |
| 71 | Hosted replay works in incognito mode | Proven at pre-audit SHA; final SHA recheck required after push | P |
| 72 | Build fingerprint matches source | Proven at pre-audit SHA; final SHA recheck required after push | P |
| 73 | README shows the real map | Proven | O |
| 74 | Product GIF demonstrates drilldown | Proven | O |
| 75 | Judge Guide contains the map route | Proven | O |
| 76 | Video shows candidate versus reviewed contribution | Proven as the committed storyboard/plan; no fabricated finished video claim | O |
| 77 | Devpost wording uses potential coverage contribution | Proven | O |
| 78 | Every public number is artifact-backed | Proven | E/F/L/O and truthful-demo verifier |

## Current command receipts

```text
PYTHONPATH=. uv run --locked python scripts/build_baseline_provider_union.py --check
  passed: observations=19,201; projections=57,603
PYTHONPATH=. uv run --locked python scripts/build_geographic_impact.py --check
  passed: cells=20,237; summaries=385
uv run --locked python scripts/verify_geographic_impact.py
  passed: mismatch_count=0
uv run --locked pytest -q
  914 passed
npm --prefix apps/web test
  545 passed, 1 intentional skip
npm --prefix apps/web run check
  passed
npm --prefix apps/web run build:deployment
  passed: 73 fingerprinted files
LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu \
  PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm --prefix apps/web run test:e2e
  67 passed, 1 explicit human-study measurement skip
npm --prefix apps/web run test:visual
  20 passed
npm --prefix apps/web run test:performance
  3 passed
npm --prefix apps/web run test:performance-budgets
  passed
npm --prefix apps/web run test:supabase
  4 migrations validated in local PostgreSQL
npm --prefix apps/web audit --audit-level=high
  0 vulnerabilities
git diff --check
  passed
```

The first browser attempt omitted the documented temporary `LD_LIBRARY_PATH` and stopped before
application code because Chromium and Firefox could not load host libraries. The authoritative rerun
used the existing extracted library directory and passed all application assertions. WebKit passed
even in the first attempt. This host workaround is not an application dependency.

## Scientific boundary and next human action

Allowed claims remain limited to exact selected-snapshot evidence, candidate-only potential,
deterministic comparison metrics and zero retained human/release outcomes. Biological absence,
confirmed novelty, occurrence release, accuracy, population quality and human productivity remain
blocked.

The next recommended scientific action is unchanged: retain at least 20 decisive owner-group
outcomes in the representative Flickr audit, publish the first valid QualitySnapshot, and
rematerialize Geographic Impact. Only genuine review and independent release-gate evidence may
move an amber candidate-only cell into human-supported or release-ready maturity.
