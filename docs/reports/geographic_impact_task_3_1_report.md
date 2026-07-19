# Geographic Impact Task 3.1 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `c377a40eecbf6a00a9cca24d13ef156cba436fc2`
- TaxaLens task push SHA: `64178d6cfe7bd7a1f98b004b390a0f95308a524b`
- Verified remote `origin/main`: `64178d6cfe7bd7a1f98b004b390a0f95308a524b`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

## Component boundary

`GeographicWorkloadMap` is now canonically named `FlickrWorkloadMap` across its
filename, React export, dashboard import, barrel export, and tests. No deprecated
component alias remains. The analytical query module, projection helper, CSS
hooks, and E2E selectors keep their established names because this task did not
change the underlying operational calculation or visual layout.

The component root now exposes stable semantic attributes:

- `data-map-purpose="flickr-operational-workload"`;
- `data-evidence-semantics="candidate-distribution-only"`;
- `data-scientific-claim-allowed="false"`.

It still loads only the checksum-verified Flickr assignments and cluster Parquets,
starts DuckDB-Wasm only after an explicit user action, renders the equirectangular
centroid SVG, exposes exact cluster values in a table, and reports no-geo,
unassigned, outlier, and dispersion workload. It does not load the new geographic
impact artifacts or calculate baseline comparison, contribution, review maturity,
or release readiness.

## Navigation and copy

The displayed product name and judge-tour step are now **Flickr Workload Map**.
The tour focuses the map section directly. Product copy states the two separate
research questions:

- Flickr Workload Map answers where Flickr processing work exists.
- Geographic Impact Lens asks where baseline occurrence evidence exists and
  where Flickr candidate evidence could add potential coverage after human review
  and release gates.

The operational map retains candidate-only, no-occurrence, no-external-map,
dispersion-not-uncertainty, missing-H3, and unavailable-review-density boundaries.
No dead Geographic Impact navigation link or unimplemented drilldown claim was
added.

## Commits

- `4740ca839e1d8f42a4995dd063c4eea9efd58153` —
  `refactor(dashboard): rename Flickr workload map`
- `1be403eb32db87c292a03ed95929fb044d8bc066` —
  `test(dashboard): preserve workload map semantics`
- `64178d6cfe7bd7a1f98b004b390a0f95308a524b` —
  `docs(dashboard): distinguish workload and impact maps`

GitHits records `geo-impact-3.1`, `geo-impact-3.1.1`, `geo-impact-3.1.2`, and
`geo-impact-3.1.3` are present. The task-level request returned no result through
two bounded waits and was terminated once. Focused calls were not repeated.
Every record uses `githits_status: unavailable`; no external implementation or
copy was used.

## Verification

- Full frontend suite: 361 passed, one skipped; 113 files passed, one skipped.
- Focused component, projection, facade, shell, and tour tests: passed.
- TypeScript project check: passed.
- Production build: passed.
- Chromium workload-map journey: passed.
- Chromium deterministic judge replay: passed.
- Dashboard 1280×720 visual baseline: passed unchanged.
- Updated reduced-motion judge-tour baseline: passed.
- Provenance verifier: passed.
- `git diff --check`: passed.

The initial browser launch lacked `libnspr4`, `libnss3`, and `libasound`. The
tests used temporary unprivileged package extraction under `/tmp`; neither the
repository nor system packages were changed. The full visual command also found
two unrelated existing baseline differences: 95 pixels around the Evidence Lens
unavailable-section count and Verification copy wrapping. Those snapshots were
not rewritten because this task did not change either view. All workload-map and
intentionally changed tour visual checks pass.
