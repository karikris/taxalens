# Geographic Impact Task 8.3 report

## Outcome

Task 8.3 adds deterministic 1280×720 visual regression for the real Geographic Impact map at global, continent and country scope; reduced-motion and forced-colors captures; and a route-level accessibility audit that does not use screenshots as its semantic oracle. The synchronized exact-value table remains the complete non-map alternative.

## Version-control context

- Starting TaxaLens SHA: `3c5202f7d7238a29b70019e9804ab8581fe795c7`.
- Required branch: `main`.
- Remote `main` matched the starting SHA before implementation.
- BioMiner baseline origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`.
- BioMiner Flickr origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`.
- The unrelated modified provenance report, alternate-data-stream marker and untracked agent guides were left untouched.
- Because those unrelated files keep the worktree dirty, the updated agent guidance required remote comparison instead of pulling over another session's work.

## GitHits

- Task record: `geo-impact-8.3`.
- Subtask records: `geo-impact-8.3.1` through `geo-impact-8.3.4`.
- The broad task search timed out after 120 seconds. One failed attempt was recorded and the unavailable service was not called again for this task.
- The focused records use the current TaxaLens visual, map, table and accessibility contracts as local evidence and explicitly record `githits_status: unavailable`.
- Licence notes cover TaxaLens, MapLibre GL JS and Playwright. No external implementation was obtained or copied.

## Subtasks

### 8.3.1 Judge map baseline

Commit: `d2f5ea4` (`test(visual): protect judge impact map`)

The dedicated suite captures the real checksum-verified, locally rendered global map without masking the canvas. It requires loaded baseline and Flickr layers before capture and uses a fixed viewport, clock, locale, color scheme and device scale.

### 8.3.2 Geographic drilldown baselines

Commit: `88dcc86` (`test(visual): protect geographic drilldown`)

Matched captures protect Global, Asia and Sweden. The suite waits for the controlled camera scope and asserts each expected evidence layer. Sweden intentionally has no range-inference-eligible baseline bubble while retaining Flickr candidates; this is a zero selected-baseline state, not a biological absence claim.

### 8.3.3 Accessible visual states

Commit: `a19658f` (`test(visual): protect accessible map states`)

The reduced-motion capture verifies the actual media query and bounded transition duration before protecting the real global map. The forced-colors capture protects the textual legend, shape and stroke distinctions, bubble-scale examples, exact counts and synchronized textual summary.

### 8.3.4 Color-independent semantics

Commit: `1be334b` (`test(a11y): validate impact map semantics`)

The browser audit requires:

- a meaningful accessible name on the MapLibre canvas;
- six visible evidence labels paired with filled, hollow, crossed, dashed or dark-stroked descriptions;
- an exact-value table with baseline, candidate, review and release columns;
- keyboard selection through the table;
- a live textual announcement and synchronized selected-geography detail.

## Visual gate

The first complete run found two truthful but stale pre-existing judge-layout baselines. Evidence Lens now reports 14 unavailable sections, and Verification now lists Yes, No, Can’t tell, Can’t view and Skip. Both deltas were inspected visually and only those two snapshots were refreshed. No product behavior was changed to satisfy the images.

- Final visual suite: **20 passed**.
- Geographic Impact scope captures: **3 passed**.
- Geographic Impact reduced-motion and forced-colors captures: **2 passed**.
- Geographic Impact semantic accessibility journey: **1 passed**.
- All images use the required 1280×720 viewport.

## Other gates

- `npm --prefix apps/web test` — **541 passed, 1 skipped** across 154 files.
- `npm --prefix apps/web run check` — passed.
- Production build ran successfully for each Playwright web-server start; the existing chunk-size advisory remains measurement, not a build failure.
- `.venv/bin/python scripts/verify_provenance.py` — passed before the task report was added and is rerun in the final task gate.
- `git diff --check` — passed before the task report was added and is rerun in the final task gate.

The Ubuntu 26.04 host uses the same temporary `/tmp` browser-library bundle documented in Task 8.2. It changes neither the repository nor the system installation.

## Scientific state

The committed campaigns still retain zero human Flickr outcomes and zero release-ready occurrence candidates. Visual and semantic tests preserve candidate language, distinguish missing selected-baseline evidence from biological absence, and require Skip and Can’t view to remain excluded from human-supported contribution.
