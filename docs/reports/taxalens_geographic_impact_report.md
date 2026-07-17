# TaxaLens Geographic Impact Lens implementation report

Date: 2026-07-18 (Australia/Sydney)

Status: competition product implementation complete; scientific occurrence release blocked pending genuine human evidence

## Release identity

This report uses a non-self-referential implementation endpoint. The report and the two remaining Task 11.2 provenance commits are recorded by Git after that endpoint rather than guessed inside their own content.

| Identity | Value |
| --- | --- |
| TaxaLens starting SHA | `e85b0d225cfdad4932de95d745b936ae85a61097` |
| Geographic Impact implementation endpoint | `6444a5af8acd0b1f6803f704f43e76d6af3a7c43` |
| Remote `main` at implementation endpoint | `6444a5af8acd0b1f6803f704f43e76d6af3a7c43` |
| Implementation commits after starting SHA | 166 |
| Completed implementation tasks before final reporting | 35 (`0.1` through `11.1`) |
| Completed numbered implementation subtasks before final reporting | 129 |
| BioMiner baseline-geography SHA consumed | `247b42f3206d48bb79e2dbf97c5a92e4f207ae71` |
| BioMiner Flickr-geography SHA consumed | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| BioMiner live `main` observed at release | `c7eaa9bf3696a25a0c8229837819dccec4fb9d66` (context only, not substituted for artifact pins) |
| Primary model recorded for the goal | `gpt-5.6-sol` |
| Reasoning effort | `xhigh` |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` |

Every numbered implementation subtask has its own direct-to-`main` commit and GitHits record. Every completed task was pushed without a feature branch, pull request, merge commit or force push. Task reports retain their exact pushed SHAs.

## Bundle and snapshot contract

| Contract | Released state |
| --- | --- |
| Judge-bundle contract | `taxalens-judge-bundle:v2.0.0` |
| Hosted fixture bytes | `taxalens-judge-bundle:v1.0.0` |
| Hosted fixture ID | `papilio-demoleus-prototype-74a7d648-v3` |
| Compatibility behavior | Validate stored v1, then migrate without mutation to canonical v2 with explicit unavailable geographic sections |
| Baseline snapshot | `gbif-occurrence-search-20260715` |
| Flickr snapshot | `flickr:2026-07-15` |
| Geographic Impact manifest | `geographic-impact-manifest:e3c532a1c6310d2a0906cacc` |
| Geographic Impact build | `geographic-impact:84b8d1b69c3dae1e329a3f6b` |
| Country hierarchy | `country-hierarchy:natural-earth-v5.1.2-110m` |
| Spatial grid | H3 resolutions 3, 5 and 7 with precision-aware Flickr support |

The byte-preserved public fixture is deliberately not rewritten merely to display v2. Its loaders expose the current v2 facade while retaining all legacy source SHAs, rights, attribution and evidence. An available-v2 synthetic fixture proves the full contract and verifier but is not presented as retained scientific evidence.

## Baseline provider union

The baseline union conservatively identifies iNaturalist-origin observations delivered through GBIF before counting providers.

| Provider state | Canonical observations |
| --- | ---: |
| Baseline union | 19,201 |
| GBIF-only | 4,017 |
| iNaturalist-origin through GBIF | 15,184 |
| Direct iNaturalist delta | Unavailable; no committed direct snapshot exists |
| Exact cross-provider duplicates removed | 0 |
| Unresolved provider duplicate groups | 0 |

The provider partition reconciles exactly: `4,017 + 15,184 = 19,201`. The canonical observations produce 57,603 hierarchical spatial projections. Provider relationships remain attached to the canonical evidence; an iNaturalist-origin GBIF record is not mislabeled as a direct iNaturalist delta. The unavailable direct delta is not displayed as zero and no display-only fetch was performed.

## Geographic evidence and impact

| Evidence state | Released value |
| --- | ---: |
| Canonical baseline occurrence evidence | 19,201 observations |
| Baseline hierarchical projections | 57,603 rows |
| Flickr candidate evidence | 13,501 photos |
| Geographically supported Flickr candidates | 13,416 |
| Flickr candidates without usable comparison geography | 85 |
| Impact cells across all supported resolutions | 20,237 |
| Baseline-only cells | 693 |
| Matched cells | 183 |
| Candidate-only cells | 6,764 |
| Global default-resolution map cells | 2,155 |
| Global default-resolution candidate-only cells | 1,221 |
| Reviewed-positive Flickr rows | 0 |
| Reviewed-negative Flickr rows | 0 |
| Uncertain, media-failure or skipped retained Flickr rows | 0 |
| Pending Flickr candidates | 13,501 |
| Human-supported additional cells | 0 |
| Release-ready occurrence candidates | 0 |
| Release-ready additional cells | 0 |

Candidate-only cells are potential coverage-gap cells. They are not occurrences, new ranges or proof of biological absence. The deterministic analytics also expose nearest-baseline distance, candidate range-edge state, latest credible baseline and Flickr dates, temporal contribution, and explicit data-deficiency reasons. These metrics compare the selected snapshots; they do not establish biological novelty.

## Product delivered

The original operational view is preserved as **Flickr Workload Map**. It still answers where candidate acquisition and processing work exists. The separate **TaxaLens Geographic Impact Lens** answers where selected baseline evidence exists and where Flickr candidate evidence may contribute after review.

The Geographic Impact Lens provides:

- a bundled Natural Earth world map with no remote tiles, fonts, glyphs, sprites, telemetry or analytics;
- blue baseline bubbles and amber Flickr states with color-independent fill, stroke, dash and marker semantics;
- one shared, tested square-root count scale with exact counts in tooltips and the synchronized table;
- global, continent, country and admin1 query scopes;
- continent and country slicers, breadcrumbs, boundary selection, camera synchronization, deep links and browser history;
- exact cell details, provider composition, review maturity, temporal contribution, distance and data-deficiency state;
- country rankings and a keyboard/screen-reader-usable sortable table that remains authoritative without WebGL;
- deterministic JSON, CSV and Parquet geographic exports with methodology, manifests and SHA-256 checksums;
- no-WebGL, no-WASM, unavailable-baseline, unavailable-direct-iNaturalist and invalid-bundle states that fail visibly;
- a record-level Evidence Lens mini-map with coordinate precision, nearby baseline cells, exact geographic facts and links to Geographic Impact, cell records, baseline provenance and Verification; and
- local review-event projection without automatically creating a scientific release.

The hosted Flickr record `flickr:55081300254` demonstrates the exact record mini-map and Verification deep link. The public replay truthfully says the exact Flickr result cannot yet be viewed in the credential-free review fixture rather than substituting a different image.

## Verification and quality state

TaxaLens has a complete append-only verification architecture, but the committed scientific campaigns still retain zero human outcomes.

The 49-owner Flickr audit is representative, stratified random, weighted and ready for human work. Its geographic quality snapshot reports:

- 49 assigned owner groups;
- 49 pending items;
- zero retained events;
- zero decisive items;
- `qualitySnapshotStatus: unavailable`; and
- blockers `retained_human_outcomes_empty` and `decisive_sample_empty`.

Yes and No may become decisive evidence only under each campaign's independent-review and consensus policy. Can't tell remains uncertain. Can't view and Skip are non-scientific outcomes and do not support spatial or temporal contribution. Targeted reference, failure-discovery and reviewer-control queues may expose reviewed examples but cannot support unweighted population inference.

A reviewed target-positive result is still not release-ready. Release requires decisive positive consensus, valid coordinates, duplicate gate, valid quality snapshot, complete provenance and the configured occurrence-release policy. The committed occurrence-release decision file contains zero rows and explicitly forbids a scientific claim.

## GPT-5.6 geographic analyst

Six deterministic read-only geographic tools are available:

- `inspect_geographic_impact`;
- `compare_geographic_scopes`;
- `list_candidate_gap_cells`;
- `explain_coverage_contribution`;
- `recommend_geographic_review_batch`; and
- `inspect_baseline_provider_union`.

Counts, joins, rankings and distances come from deterministic code and cite the baseline snapshot, Flickr snapshot, impact artifacts, quality state, campaign and source commits. The stored credential-free replay uses `gpt-5.6-sol` with `xhigh` reasoning and records replay SHA-256 `090c21029302d95e0a8eb7af22e8ee93ed6b27be0f021c72547bc654fe5f2628`. It makes no live OpenAI request and allows no scientific claim.

Twenty-four deterministic evaluation cases pass at a 1.0 pass rate. They cover provider double counting, candidate/reviewed/release maturity, unavailable direct iNaturalist data, data deficiency, no-geo, range-edge candidates, invalid samples, blocked release, artifact citations, prohibited terminology and model-memory arithmetic. This is a grounding and safety evaluation, not a live-model accuracy or human-productivity result.

## Verification matrix

| Gate | Final measured result |
| --- | --- |
| Full Python | 914 passed in 27.63 seconds |
| Full frontend Vitest | 544 passed, 1 intentional skip; 154 files passed, 1 skipped |
| TypeScript | Passed |
| Native Ruff check and format | Passed; 147 native files clean at the technical gate |
| JSON Schema / Python / TypeScript parity | Passed |
| Judge bundle and truthful demo | Passed; 30 artifacts, 36 records and 3 rights-covered media files |
| Provider-union and Geographic Impact reconciliation | Passed; 20,237 cells, zero DuckDB cross-check differences |
| BioMiner boundary and pinned handoffs | Passed |
| Rights, attribution and map dependency licences | Passed |
| Production and static deployment | Passed; 73 fingerprinted files |
| Chromium full journey | Passed |
| Firefox smoke | Passed |
| WebKit smoke | Passed with the documented runtime-library host-validator workaround |
| Browser E2E matrix | 67 passed, 1 explicit measurement skip |
| Visual regression | 20 passed |
| Dedicated performance E2E | 3 passed |
| Map network guard | Passed; zero external origins |
| npm audit | 0 vulnerabilities |
| Secret-pattern scan | No matched credentials or private keys |
| Tracked large-file scan | No tracked file over 5 MiB |
| Provenance verifier | Passed |

Source-locked BioMiner compatibility files retain 46 disclosed Ruff findings across 14 files; they are not native TaxaLens lint failures and were not suppressed. Vite's generic 500 kB chunk advisory also remains visible; the measured distribution budgets pass.

## Performance

The final technical gate measured the real committed local browser path:

- artifact load: 132.6 ms for 7 files / 5,589,959 bytes;
- first full-outer query: 910.5 ms for 2,155 cells;
- cached scoped query: 0 ms;
- India drilldown query: 762.9 ms;
- bounded map feature construction: 5.2 ms for 2,155 features; and
- repeated global map initialization p95: 2,458.6 ms against a 3,225.3 ms ceiling.

One development-host country sample was a 17,770.51 ms outlier. The five-sample country median was 1,060.78 ms and passed the configured median gate. The report retains the outlier and makes no unsupported hosted-latency claim from it.

The measured production distribution is approximately 51.24 MB raw, dominated by local DuckDB-Wasm. Source maps are excluded, projection pushdown is used, raw occurrence datasets are not expanded into JavaScript objects, stale queries are cancelled, and each mounted lens keeps at most eight completed scope results and 30,000 preaggregated rows.

## Rights and redistribution

TaxaLens and BioMiner code are MIT-licensed. Natural Earth Admin 0 Countries v5.1.2 at source commit `f1890d9f152c896d250a77557a5751a93d494776` is public domain; TaxaLens retains voluntary attribution and treats boundaries as generalized display/navigation geometry, not authoritative borders or occurrence coordinates.

The browser map pins `maplibre-gl@5.24.0` under BSD-3-Clause and `@vis.gl/react-maplibre@8.1.1` under MIT. Installed licence files, notices and lockfile integrity are verified in the distribution. The public review fixture contains only three approved, checksum-bound Wikimedia Commons images with attribution. Restricted or unavailable upstream media is not copied into the public replay.

## Hosted replay

Public URL: <https://karikris.github.io/taxalens/>

The authoritative Task 11.1 post-push receipt binds source `5ea4cc4822e67bc33052a8c1f47f65d779e654b8` to build fingerprint `a5d1d5495c47facfb158fac07695fa562b88ff58c55bd9ea8e5ed7603875c2ab`. In a fresh Chromium context it verified:

- HTTPS, no login, no credentials, no backend and no cookies;
- exact source and file fingerprints;
- global → Europe → Sweden drilldown;
- cell `87088660cffffff`;
- record `flickr:55081300254` and its mini-map;
- Verification deep link;
- scientifically blocked geographic export;
- Can't view and Skip local events in the public reference fixture;
- receipt export, reset and static fallback; and
- zero unexpected origins or credential headers.

Later documentation commits necessarily advance `main`; the live `build-fingerprint.json` remains the authoritative non-self-referential source identity. The final task gate must verify the ending SHA after the Task 11.2 push rather than writing an impossible self-referential SHA into this report.

## Scientific claims

Allowed:

- the selected baseline snapshot contains 19,201 deduplicated canonical observations;
- the selected Flickr snapshot contains 13,501 candidate-evidence photos;
- the selected grids contain the exact potential coverage-gap and matched-cell counts above;
- current retained human, human-supported and release-ready counts are zero;
- the deterministic product can compare scopes, distances, dates, provider composition and review maturity; and
- the public product is a credential-free, self-contained competition replay.

Blocked:

- verified occurrence, new Flickr records, official records or records added to science;
- confirmed knowledge gain, new range or species absence from GBIF;
- human-supported or release-ready contribution while retained outcomes are zero;
- direct iNaturalist provider comparison while its snapshot is unavailable;
- accuracy, precision, recall, prevalence, calibration or population-quality inference without valid independent evidence;
- human time savings, productivity or causal impact without genuine study sessions; and
- any model-memory calculation or GPT-authorized scientific decision.

## Human work remaining

The geographic usability study is ready but remains `pending_human_data`: zero participants, sessions, timings, confidence ratings or interpretation results are committed. Optional Supabase/B2 collaboration and a live OpenAI call are also not required by, and not executed in, the public replay.

The exact next recommended action is to complete and retain at least 20 decisive owner-group outcomes in the representative 49-owner Flickr audit under its two-reviewer, conflict and adjudication policy. Export and import those append-only events, publish the first valid `QualitySnapshot`, then rematerialize Geographic Impact. That will reveal whether any amber candidate-only cells become human-supported while the independent occurrence-release gate remains explicit.
