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

## Factories and helpers

No exported factory class was found that merely wraps a constructor. The review repository creation helpers are private policy functions: they select durable IndexedDB when available and an in-memory repository when browser storage is absent. Combining them into the component would duplicate seed construction and obscure the explicit fallback policy, so they remain.

Builder functions in evidence, impact, dashboard, and agent modules are deterministic model transformations with direct unit coverage. Their names describe construction, but they do not introduce factory layers or mutable service locators. The geographic cache-key helper, bubble scale, SQL builders, feature builder, and quality builders each encode independently tested contracts and remain.

## Configuration

The Vite, Vitest, Playwright, and performance Playwright files select different runtime and measurement policies; merging them would create conditional configuration rather than remove complexity. The repeated loopback URL is local, stable test configuration and does not justify another shared helper.

One configuration mismatch requires correction: `tsconfig.node.json` type-checks the normal Playwright configuration but omits `playwright.performance.config.ts`. The performance configuration therefore sits outside the declared Node configuration even though it is executable project code. It should be added to the include list.

The Supabase migrations already use explicit authenticated grants, forced RLS, trusted `app_metadata` roles, append-only event constraints, and a service-role boundary. They already match the 2026 Supabase Data API grant posture; no compensating migration is needed.

## Previous-phase implementation quality

The prior completion matrix, current source inspection, and current call-site audit support the following conclusions:

- Geographic contracts, bundle v2, v1 migration, artifact-first BioMiner handoffs, provider union, impact materialization, browser queries, offline map, verification projection, quality gates, Evidence Lens context, analyst tools, exports, browser coverage, rights, and provenance are implemented.
- Pilot literals remain confined to the fixture validator, fixtures, stored replays, and fixture-specific tests. No `13_501` product-level guard was found.
- Provider, release, verification, and unavailable-evidence terminology remains fail-closed. Deliberate unavailable states are evidence boundaries, not unfinished implementations.
- The review root compatibility layer is the main redundant pre-uplift residue found in runtime source.
- The Node type-check include omission is the clearest configuration quality gap.

## Unfinished work classification

No `TODO`, `FIXME`, placeholder implementation, or unimplemented technical phase was found in production source. Remaining previous-goal items require real external or human evidence and must not be fabricated:

- decisive human Flickr audit outcomes;
- independently reviewed scientific evaluation and valid population estimates;
- direct iNaturalist delta when no committed direct snapshot exists;
- human usability-study participants and measurements;
- the exact `/feedback` session receipt when that product command is unavailable.

The implementation may prepare and validate imports for those outcomes, but it cannot truthfully mark them complete without the evidence.

## Planned remediation and gates

1. Remove the twelve unowned review compatibility modules and update tests and production imports to canonical modules.
2. Rename the workspace regression test and symbols to `VerificationWorkspace` without reducing coverage.
3. Add the performance Playwright configuration to the Node TypeScript project.
4. Run focused review tests, TypeScript, Vitest, Python, contract/provenance/rights verifiers, production build, browser suites, visual regression, performance checks, audit/secret/large-file scans, and `git diff --check`.
5. Re-run dead-path and unfinished-work searches after cleanup.

This report records analysis before behavior-changing cleanup. Each remediation receives focused GitHits provenance and its own commit.
