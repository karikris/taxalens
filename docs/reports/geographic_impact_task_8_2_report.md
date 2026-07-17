# Geographic Impact Task 8.2 report

## Outcome

Task 8.2 adds route-level browser coverage for the Geographic Impact research journey, cross-browser map smoke, same-origin network enforcement, unavailable evidence and restricted runtimes. The public replay remains credential-free and no test fabricates a human Flickr outcome.

## Version-control context

- Starting TaxaLens SHA: `ffda2a56815e25a13dbb5c596c7dfc244876260b`
- Required branch: `main`
- Remote `main` matched the starting SHA before implementation.
- BioMiner baseline origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- The unrelated modified provenance report, alternate-data-stream marker and untracked agent guides were left untouched.
- Because those unrelated files keep the worktree dirty, the updated agent guidance required remote comparison instead of pulling over another session's work.

## GitHits

- Task record: `geo-impact-8.2`.
- Subtask records: `geo-impact-8.2.1` through `geo-impact-8.2.4`.
- Broad solution: `ae1a3a38-3a0e-45ea-92d0-ed4d12bc9828`, with MIT GeoLibre and bird-sight-system references.
- Cross-browser smoke solution: `c6546689-3eb7-486f-9eba-a78246b4c43d`, with an MIT qaskills reference.
- Unavailable-state solution: `d6bab56d-93ce-4b39-aea7-5da374ff1d1d`, with an MIT Nexpo reference.
- Two focused searches returned no qualifying result; their solution IDs and negative feedback are recorded rather than fabricated into precedents.
- No external implementation was copied.

## Subtasks

### 8.2.1 Chromium full journey

Commit: `337c3e2` (`test(e2e): cover Geographic Impact journey`)

The route covers Dashboard → Global → Europe → Sweden → selected cell → Evidence Lens record → Verification → local reference decision → return to Dashboard → selected cell → export manifest. The reference decision is intentionally not treated as a reviewed Flickr outcome: the map still reports zero local Flickr-audit events and zero release-ready occurrence candidates.

### 8.2.2 Firefox and WebKit smoke

Commit: `f114641` (`test(e2e): add cross-browser map smoke`)

The smoke test is selected by the repository's `.smoke.spec.ts` project contract. It requires verified geographic evidence, the exact accessible table, a real MapLibre canvas or explicit WebGL fallback, and a working continent scope change.

### 8.2.3 Offline replay

Commit: `0c78c6e` (`test(e2e): enforce offline map replay`)

The origin guard now remains active across Dashboard, export preparation, Evidence Lens, the blocked Flickr Verification route, return navigation and the map reload. It records attempted HTTP, service-worker, worker, WebSocket and performance-resource traffic. A blocked external attempt is a failure, not a pass.

### 8.2.4 Failure states

Commit: `3a97f3f` (`test(e2e): cover geographic failure states`)

The new tests distinguish:

- an available candidate-only cell with zero selected baseline evidence;
- unavailable direct iNaturalist delta;
- zero retained human-reviewed and release-ready Flickr evidence;
- a corrupt source Parquet that stops before table or export rendering;
- a missing analytical worker that renders an explicit unavailable state.

Existing browser tests complete the gate for no WebGL, no WebAssembly, missing media, corrupt media, offline media and unavailable persistence.

## Browser execution

The Ubuntu 26.04 host initially lacked browser shared libraries and passwordless system installation was unavailable. A temporary `/tmp` library bundle was built from official Ubuntu binary packages. It changed neither the repository nor the system installation.

- Chromium Geographic Impact journey: **1 passed**.
- Chromium final geographic/restricted suite: **15 passed** across journey, network, smoke, table, unavailable and restricted-browser specs.
- Firefox Geographic Impact smoke: **1 passed**.
- WebKit Geographic Impact smoke: **1 passed** using the temporary GLES preload and Playwright's validation bypass for the non-system library path.
- Chromium explicit no-WebGL table fallback: passed.
- Chromium explicit no-WebAssembly stopped inspection: passed.
- Offline network audit: passed with zero violations.

## Other gates

- `npm --prefix apps/web test` — **541 passed, 1 skipped** across 154 files.
- `npm --prefix apps/web run check` — passed.
- Production build ran successfully for each Playwright web-server start; the existing chunk-size advisory remains measurement, not a build failure.
- `.venv/bin/python scripts/verify_provenance.py` — passed.
- `git diff --check` — passed.

## Scientific state

The committed replay still contains zero retained human Flickr outcomes. The browser journey demonstrates a real local reference-review event while proving it cannot be projected as Flickr support or scientific release. Missing selected baseline evidence remains unknown rather than biological absence, and direct iNaturalist delta remains unavailable rather than fabricated.

