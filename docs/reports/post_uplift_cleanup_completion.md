# Post-uplift cleanup and completion report

Date: 2026-07-18 (Australia/Sydney)

Status: product cleanup and Geographic Impact implementation verified complete; scientific occurrence release remains blocked pending genuine human evidence.

This report uses a non-self-referential implementation endpoint. Its own documentation commit is recorded by Git and in the final Codex response rather than guessed inside the file.

## Release identity

| Identity | Value |
| --- | --- |
| Audit starting SHA | `c5e87ead4fdb26d5c5624bbb8d8d67e46d8eddbc` |
| Verified implementation endpoint | `e6211b7cb3a7fed312cd0e263ac0d48916c6019d` |
| Remote `main` at implementation endpoint | `e6211b7cb3a7fed312cd0e263ac0d48916c6019d` |
| Direct-to-main audit commits | 7 |
| Primary model | `gpt-5.6-sol` |
| Reasoning effort | `xhigh` |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` |
| Judge bundle | `taxalens-judge-bundle:v2.0.0` |
| Bundle ID | `papilio-demoleus-prototype-74a7d648-v3` |
| Geographic Impact manifest | `geographic-impact-manifest:e3c532a1c6310d2a0906cacc` |
| Baseline snapshot | `gbif-occurrence-search-20260715` |
| Flickr snapshot | `flickr:2026-07-15` |

All audit commits were made directly on `main` and pushed without a feature branch, pull request, merge, history rewrite or force-push.

## Redundant layers removed

The cleanup removed code only where no production, public-package or protocol invariant remained:

- twelve obsolete root-level review forwarding modules and the historical `HumanReviewWorkspace` alias;
- the second `GeographicImpactMapCache` and its duplicate tests;
- the standalone public map DuckDB query, decoder and direct Parquet loader;
- duplicate Vite `?url` Parquet imports and same-origin verification in record context and local review projection; and
- the DuckDB MVP/EH bundle selector and redundant MVP worker/Wasm payload.

Production now has one geographic analytical path: a checksum-verified `TaxaLensProjectFacade` supplies immutable artifact bytes to `GeographicImpactQueryController`, whose bounded LRU, cancellation and stale-result suppression are shared by the product and performance tests. Map, accessible table, details and export adapt the same reconciled full-outer result.

The following thin-looking boundaries remain because they own real invariants: `BundleVerifier`, `BundleLoader`, `TaxaLensProjectFacade`, `PapilioJudgeFixtureValidator`, the geographic source loader, query controller and bounded cache, storage repositories, BioMiner adapters, v1-to-v2 migration, `FlickrWorkloadMap`, and the documented Python product API.

## Quality corrections

- The hosted fixture is now a concrete v2 bundle with 39 checksum-verified artifacts and all six geographic sections available.
- Fixture literals remain isolated in `PapilioJudgeFixtureValidator` and tests; production geographic reads are scoped by project, run, taxon and both snapshots.
- Export provenance derives from the verified project manifest rather than fixture imports.
- DuckDB uses the local exception-handling worker, so SQL failures remain inspectable. Removing the MVP duplicate reduced the runtime payload by about 5.2 MB.
- Record geographic context and local review projection reuse facade-verified bytes, eliminating two duplicated emitted Parquets.
- The raw static distribution is 50,071,505 bytes. Its 7,044,964-byte geographic group now counts the baseline provider union, hierarchy, maturity and release artifacts instead of omitting them.
- The B2 repository mirror now covers 112 configured objects, 21,210,728 bytes, with exact SHA-256 and repository paths. Supabase mirrors retain zero events, consensus outcomes and quality snapshots.
- Stale v1 release assertions now validate the v2 zero-row consensus and release artifacts as `partial`, `human_review_pending`, and scientifically blocked.

## Geographic evidence state

| Measure | Verified value |
| --- | ---: |
| Baseline provider union | 19,201 |
| GBIF-only | 4,017 |
| iNaturalist-origin through GBIF | 15,184 |
| Direct iNaturalist delta | Unavailable |
| Cross-provider duplicates removed | 0 |
| Unresolved provider duplicate groups | 0 |
| Flickr candidate rows | 13,501 |
| Geographically supported Flickr rows | 13,416 |
| Impact cells | 20,237 |
| Candidate-only cells | 6,764 |
| Global resolution-3 map cells | 2,155 |
| Global candidate-only cells | 1,221 |
| Human-reviewed Flickr rows | 0 |
| Human-supported additional cells | 0 |
| Release-ready rows | 0 |

Direct iNaturalist delta remains unavailable because no committed direct snapshot exists. Missing baseline evidence remains unknown, not biological absence. Candidate-only cells are potential coverage gaps, not occurrences or new ranges.

## Runtime and release verification

| Gate | Result |
| --- | --- |
| Python | 914 passed |
| Frontend unit/integration | 543 passed, 1 intentional skip |
| TypeScript | passed |
| Native Ruff | 148 TaxaLens files clean; source-locked compatibility findings reported separately |
| Chromium | 63 passed, 1 intentional skip |
| Firefox smoke | 2 passed |
| WebKit smoke | 2 passed |
| Performance | 3 browser benchmarks passed |
| First geographic query | 930.2 ms; 2,155 cells; exact totals reconciled |
| Scoped cache | 0.1 ms hit |
| Country drilldown | India, 813.8 ms, 208 cells |
| Map initialization | 2,965.7 ms p95 across 5 samples |
| External map/network requests | 0 |
| Static deployment | build, prepare and fingerprint verification passed |
| Supabase migrations | four migrations validated in PostgreSQL with RLS/grant boundaries |
| Map rights/dependencies | passed; bundled notices present |
| npm audit | 0 vulnerabilities |
| Provenance and geographic verifiers | passed |

The hosted Pages deployment at `https://karikris.github.io/taxalens/` verifies source SHA `e6211b7cb3a7fed312cd0e263ac0d48916c6019d`, hosted fingerprint `818417c0923cea663409e5ade4631aa8988d8cc11cd10e88bd755aed193d1a1c`, 83 files, no login, no credentials and no unexpected origins. Global, continent and country drilldown, record link, Verification link, reset and export all passed in a fresh browser context.

## Agent and verification status

All six deterministic geographic tools remain present: `inspect_geographic_impact`, `compare_geographic_scopes`, `list_candidate_gap_cells`, `explain_coverage_contribution`, `recommend_geographic_review_batch`, and `inspect_baseline_provider_union`. The credential-free stored replay remains enabled. The geographic evaluation passes all 24 safety and grounding cases with no live OpenAI call.

The verification product is complete, including Yes, No, optional comment, Can't view and Skip. Can't view and Skip remain non-decisive and do not add geographic contribution. A local review does not become a scientific release automatically.

BioMiner evidence consumed by this release remains pinned to `247b42f3206d48bb79e2dbf97c5a92e4f207ae71` for baseline geography and `75461d9c065af0cd96b41cd1f845c2e920f7ae34` for Flickr geography. A newer BioMiner `main` was observed during verification but was not substituted for these immutable artifact pins. Its committed Papilio artifacts also report zero independently human-verified records, consistent with the TaxaLens release boundary.

## Claims and remaining human work

Allowed product claims:

- baseline occurrence evidence and Flickr candidate evidence can be compared on a shared grid;
- Flickr exposes potential geographic coverage contribution in candidate-only cells;
- provider relationships and unavailable direct iNaturalist delta remain explicit; and
- the self-contained replay and verification workflow are operational.

Blocked scientific claims:

- official or new Flickr records;
- confirmed knowledge gain, a new range or biological absence;
- human-supported or release-ready contribution above zero;
- population precision, accuracy or calibrated probability; and
- completed usability-study impact.

Human work remaining is unchanged: retain genuine decisive audit outcomes, meet independent-review and quality milestones, adjudicate conflicts, pass occurrence-release gates, and run the usability study with real participants. The exact next action is to complete and import the first 20 decisive representative Flickr audit outcomes; no software change can truthfully replace that evidence.

## GitHits and instruction state

The audit recorded 6 task-level and 8 focused GitHits records. Nine returned usable precedent, one returned no quality-threshold match, and four timed out or were unavailable; no result or licence was fabricated and no external code was copied.

The updated local `AGENTS.md` and `docs/agents/` pack were acknowledged and used for final task boundaries, evidence semantics, direct-main provenance, storage, browser and release verification. Those operator-owned files were not staged by this work.
