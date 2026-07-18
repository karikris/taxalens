# Post-uplift architecture audit

Audit date: 2026-07-18  
TaxaLens baseline: `c5e87ead4fdb26d5c5624bbb8d8d67e46d8eddbc`  
BioMiner inspected baseline: `387887bb86d7c276d83eca6e29f328ea73b8d676`

## Scope and decision rule

This audit traces the implementation left by the verification, storage, and Geographic Impact uplifts. It focuses on helpers, wrappers, factories, configuration, and architectural layers. A layer is justified only when it owns at least one observable invariant, isolates an external protocol, provides a stable consumed boundary, or coordinates state that cannot safely live at a call site.

Test-only imports do not establish a production compatibility contract. Small files are not automatically redundant: source-locked BioMiner constants, schema adapters, storage clients, validators, migrations, caches, and cancellation controllers remain meaningful even when their implementation is short.

## Remove

The verification folder migration retained a root compatibility layer after all production code had moved to canonical folders. Git history shows these files were introduced as forwarding modules during `refactor(review): separate verification domain services` and `refactor(review): split verification workspace components`. Current call-site analysis finds no published package export and no production consumer that still needs the old paths.

| Legacy path or layer | Current behavior | Why it is redundant | Replacement |
| --- | --- | --- | --- |
| `review/HumanReviewWorkspace.tsx` | Renames `VerificationWorkspace` | Alias has no distinct behavior or external owner | Import `VerificationWorkspace` |
| `review/inMemoryReviewRepository.ts` | Re-exports one repository module | Tests are its only consumers | Canonical repository module |
| `review/indexedDbReviewRepository.ts` | Re-exports one repository module | Tests are its only consumers | Canonical repository module |
| `review/legacyReviewMigration.ts` | Re-exports one repository module | Tests are its only consumers | Canonical repository module |
| `review/reviewRepository.ts` | Re-exports one repository module | Tests are its only consumers | Canonical repository module |
| `review/reviewSync.ts` | Re-exports one repository module | No consumers | Canonical repository module |
| `review/supabaseReviewRepository.ts` | Re-exports two repository modules | Tests are its only consumers | Import the two canonical modules explicitly |
| `review/verificationContracts.ts` | Re-exports one domain module | Packet code and tests can use the canonical domain module | Canonical domain module |
| `review/verificationEvents.ts` | Re-exports one domain module | Tests are its only consumers | Canonical domain module |
| `review/privateMedia.ts` | Re-exports two media modules | No consumers | Canonical media modules |
| `review/reviewStore.ts` | Aggregates five unrelated modules under a historical name | Tests are its only consumers and the name obscures ownership | Exact domain, export, media, and repository modules |
| `review/index.ts` | Re-exports the entire subsystem and old alias | The application consumes only one component; the test consumes packet constants | Direct component and packet imports |
| `impact/GeographicImpactMapCache` | Holds a second unbounded map-data cache | Duplicates the controller's bounded, scope-complete LRU and bypasses its cancellation metrics | `GeographicImpactQueryController` and `GeographicImpactQueryCache` |
| `loadPublicGeographicImpactMapData` query/decoder | Starts a second DuckDB runtime over one materialized Parquet | Duplicates source registration, decoding, checks, and cleanup while skipping the full-outer analytical path | Adapt the verified `GeographicImpactBrowserResult` to the view model |
| Record-context and review-projection `?url` Parquet imports | Re-emit Flickr geography and impact cells as Vite assets, then verify and query them again | The concrete v2 facade already loaded and checksum-verified the same bytes | Manifest-bound artifacts from `TaxaLensProjectFacade` |
| DuckDB MVP bundle selection | Selects between only an MVP bundle and, temporarily, duplicated MVP/EH payloads | The shipped MVP worker hides SQL errors; selecting a known local EH runtime does not require a factory | One pinned local EH worker/Wasm bundle with explicit failure handling |

The large workspace regression suite remains valuable, but its symbol and description should use the canonical `VerificationWorkspace` name.

## Retain

The following superficially similar abstractions carry real boundaries and should not be collapsed.

| Layer | Invariant or boundary retained |
| --- | --- |
| `BundleVerifier` | Orders contract migration before semantic verification |
| `BundleLoader` | Reads and verifies every declared artifact before exposing a project |
| `TaxaLensProjectFacade` | Provides immutable, manifest-scoped artifact access |
| `PapilioJudgeFixtureValidator` | Contains fixture-specific identities so product logic remains generic |
| Geographic facade loader functions | Require project, run, taxon, and snapshot scoping for every geographic read |
| `GeographicImpactQueryController` | Owns cancellation, supersession, disposal, and cache interaction for interactive queries |
| `GeographicImpactQueryCache` | Enforces bounded LRU memory and scope-complete cache keys |
| `loadDuckDbRuntime` and `createDuckDbRuntime` | Separate lazy module availability from worker/database lifecycle and cleanup |
| IndexedDB, Supabase, B2/media, and in-memory repositories | Isolate external persistence protocols and preserve offline/test behavior |
| BioMiner adapter modules and source-locked constants | Preserve upstream artifact semantics and exact provenance without importing engine code |
| Judge-bundle v1 migration | Required backward compatibility; it marks missing v2 geography unavailable rather than inventing evidence |
| `FlickrWorkloadMap` | Preserved operational workload semantics distinct from scientific Geographic Impact semantics |
| `review/domain`, `review/repositories`, `review/exports`, `review/routing`, and `review/ui` indexes | Consumed subsystem boundaries; callers import a coherent capability rather than a historical root compatibility path |
| `taxalens.__main__` and package `__init__` modules | Standard Python package and CLI entry points |
| Python `taxalens.product` facade functions | Thin convenience wrappers, but explicitly exported and smoke-tested as the public package boundary; remove only through a versioned deprecation |

## Factories and helpers

No exported factory class was found that merely wraps a constructor. The review repository creation helpers are private policy functions: they select durable IndexedDB when available and an in-memory repository when browser storage is absent. Combining them into the component would duplicate seed construction and obscure the explicit fallback policy, so they remain.

Builder functions in evidence, impact, dashboard, and agent modules are deterministic model transformations with direct unit coverage. Their names describe construction, but they do not introduce factory layers or mutable service locators. The geographic cache-key helper, bubble scale, SQL builders, feature builder, and quality builders each encode independently tested contracts and remain.

## Configuration

The Vite, Vitest, Playwright, and performance Playwright files select different runtime and measurement policies; merging them would create conditional configuration rather than remove complexity. The repeated loopback URL is local, stable test configuration and does not justify another shared helper.

One configuration mismatch was corrected: `tsconfig.node.json` type-checked the normal Playwright configuration but omitted `playwright.performance.config.ts`. The performance configuration is now included in the declared Node project.

The Supabase migrations already use explicit authenticated grants, forced RLS, trusted `app_metadata` roles, append-only event constraints, and a service-role boundary. They already match the 2026 Supabase Data API grant posture; no compensating migration is needed.

## Previous-phase implementation quality

The prior completion matrix, current source inspection, and current call-site audit support the following conclusions:

- Geographic contracts, bundle v2, v1 migration, artifact-first BioMiner handoffs, provider union, impact materialization, browser queries, offline map, verification projection, quality gates, Evidence Lens context, analyst tools, exports, browser coverage, rights, and provenance are implemented.
- Pilot literals remain confined to the fixture validator, fixtures, stored replays, and fixture-specific tests. No `13_501` product-level guard was found.
- Provider, release, verification, and unavailable-evidence terminology remains fail-closed. Deliberate unavailable states are evidence boundaries, not unfinished implementations.
- The review root compatibility layer was the main redundant pre-uplift residue found in runtime source. Its twelve forwarding modules have been removed, and consumers now use canonical domain, repository, export, media, and UI paths.
- The Node type-check include omission has been corrected.
- A deeper runtime trace found a more important integration mismatch: `GeographicImpactQueryController`, its bounded cache, and the real DuckDB-Wasm full-outer source join were used by unit and performance tests, but not by `GeographicImpactLens`. The production lens owned a second cache and queried only the already-materialized impact-cell Parquet. This duplicate path is now removed; production owns the same scoped controller and reconciled full-outer query exercised by tests.
- The hosted judge fixture was upgraded during this audit to a concrete v2 bundle whose geographic artifacts are checksum-bound to the committed impact manifest. The v1 migration remains covered as a compatibility boundary and does not invent missing geography.
- The DuckDB MVP worker masked SQL failures behind its own missing `_setThrew` runtime symbol. TaxaLens now uses the exception-handling worker directly, so SQL failures remain inspectable. Removing MVP fallback assets also removes roughly 40.2 MB of uncompressed duplicate production payload while preserving the explicit no-WASM unavailable state.

## Unfinished work classification

No `TODO`, `FIXME`, or placeholder implementation was found in production source. The two technical integration gaps found by this audit are complete:

- the hosted judge fixture is a concrete v2 bundle containing verified baseline, Flickr, impact, summary, hierarchy, and impact-manifest artifacts;
- the production Geographic Impact lens uses the scoped full-outer query controller, bounded cache, cancellation, and engineering metrics exercised by tests and the performance harness.

Other remaining previous-goal items require real external or human evidence and must not be fabricated:

- decisive human Flickr audit outcomes;
- independently reviewed scientific evaluation and valid population estimates;
- direct iNaturalist delta when no committed direct snapshot exists;
- human usability-study participants and measurements;
- the exact `/feedback` session receipt when that product command is unavailable.

The implementation may prepare and validate imports for those outcomes, but it cannot truthfully mark them complete without the evidence.

## Remediation completed

1. Removed the twelve unowned review compatibility modules and updated tests and production imports to canonical modules.
2. Renamed the workspace regression test and symbols to `VerificationWorkspace` without reducing coverage.
3. Added the performance Playwright configuration to the Node TypeScript project.
4. Published the concrete judge bundle v2 and retained fail-closed v1 migration coverage.
5. Removed `GeographicImpactMapCache` and the standalone public Parquet query/decoder. The lens now adapts a single verified controller result for the map, accessible table, details, and export.
6. Made export provenance derive from the verified bundle and impact manifest rather than fixture imports.
7. Switched to the DuckDB exception-handling worker and removed the redundant MVP worker/Wasm production assets.
8. Added a production-ownership test proving the dashboard facade supplies the verified project and the lens invokes the scoped controller.
9. Reused facade-verified Flickr and impact bytes in record context and local review projection, removing two duplicate emitted Parquets and their second same-origin verification layer.
10. Re-measured the complete v2 bundle: all geographic artifacts are now counted by the budget, while the total raw distribution is smaller than the pre-v2 baseline because duplicate runtime and evidence assets were removed.

## Audit extension: runtime ownership

The initial thin-file scan correctly found the review compatibility layer, but a name-and-consumer scan also found that `GeographicImpactQueryController` appears only in its unit test and the performance E2E harness. This is not evidence that the class should be deleted. Its cancellation, cache-key scoping, bounded LRU policy, and full-outer source comparison implement explicit prior requirements.

The mismatch was the opposite: production did not own the tested analytical path. `GeographicImpactLens` called `loadPublicGeographicImpactMapData`, which verified and filtered `geographic_impact_cells.parquet`; it did not independently aggregate baseline and Flickr sources. The v1 hosted fixture also could not supply the v2 project facade because its six geographic sections are intentionally synthesized as unavailable during migration.

Remediation proceeded in dependency order:

1. upgrade the committed hosted fixture to a concrete v2 bundle with checksum-bound baseline, Flickr, impact, summary, hierarchy, and impact-manifest artifacts while preserving v1 migration tests;
2. expose the verified `TaxaLensProjectFacade` through the loaded evidence facade;
3. extend the shared browser result with the inspected materialized provider and temporal fields;
4. replace the production-only map loader/cache with `GeographicImpactQueryController`;
5. remove the preaggregated loader and its second cache after migration because they had no distinct product semantics;
6. run the production journey, query-cancellation, cache, no-WASM, offline-network, reconciliation, visual, and performance gates.

The real-browser production path now reports 2,155 global resolution-3 cells, reconciles 19,201 baseline-union observations and 13,416 Flickr candidates, returns a country drilldown, uses the scoped memory cache, and makes zero external requests. These are fixture-backed execution results, not scientific release claims; retained human-reviewed and release-ready counts remain zero.

This report records both the original analysis and completed behavior-changing cleanup. Each remediation has focused GitHits provenance and a scoped commit.
