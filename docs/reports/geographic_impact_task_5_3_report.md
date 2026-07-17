# Geographic Impact Lens Task 5.3 Report

## Scope

Task 5.3 adds deterministic, credential-free browser exports for the
Geographic Impact Lens. TaxaLens started this task at
`c6198413e57d605775e4c3860d07e1de52e9a22b` on `main`.

The export is a portable evidence boundary. It does not upload data, add a
human outcome, pass an occurrence-release gate or create a scientific
release.

## Export contents

Preparing an export creates seven independently downloadable files:

1. selected-scope impact cells as canonical JSON;
2. selected-scope impact cells as exact CSV;
3. the verified preaggregated impact-cells source Parquet;
4. the selected-scope summary as canonical JSON;
5. the selected-scope summary as metric/value CSV;
6. methodology and provenance as canonical JSON; and
7. an unsigned SHA-256 manifest.

The JSON and CSV files contain the current global, continent, country or
admin1 scope at its supported resolution. The Parquet is deliberately
preserved byte-for-byte from the committed source artifact and is explicitly
labelled `full_target_all_supported_resolutions`; it is not described as a
selected-scope serialization.

The source Parquet is accepted only when its opening and closing Parquet magic,
639,681-byte length and SHA-256 all match the verified impact manifest:

`a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9`

## Scope summaries

Scope summaries reuse the exact tested selected-geography projection shown in
the product. They include:

- hierarchy level, identity, name and parent;
- baseline union, eligible, excluded and provider counts;
- unavailable direct iNaturalist delta as explicit status plus `null` value;
- pending, positive, negative, uncertain and release-ready Flickr counts;
- candidate-only, human-supported and release-ready additional cells;
- nearest-baseline distance and date fields;
- data-deficiency state counts;
- five candidate range-edge maturity counts; and
- separate candidate, human-supported and release-ready uplift numerators,
  denominators and percentages.

Unavailable values are never coerced to zero.

## Methodology and provenance

The methodology file projects the committed Geographic Impact manifest and
architecture decision. It records:

- build, manifest, project, run, registry, target and hierarchy identities;
- baseline and Flickr snapshots;
- BioMiner commits
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71` and
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`;
- all TaxaLens source commits listed by the impact manifest;
- every source artifact path, schema, SHA-256, rights identity and
  availability state;
- full-outer cell comparison and provider-union semantics;
- same-resolution centroid haversine distance;
- temporal comparison and data-deficiency boundaries;
- human-review and occurrence-release requirements;
- allowed and blocked claim categories; and
- current zero-human-outcome and unavailable quality-snapshot limitations.

No execution timestamp is added. The file states that SHA-256 verifies bytes
and evidence identity, not scientific truth, quality or source independence.

## Determinism and manifest

Canonical JSON recursively sorts object keys, preserves array order, uses
UTF-8 and ends with one newline. CSV uses a fixed column order, RFC-compatible
escaping and CRLF row endings. Cells sort by resolution and spatial-cell ID.

Every payload is hashed before the manifest is created. The manifest contains
role, filename, media type, byte count and SHA-256 for all six payload files.
The manifest excludes a self-digest; its own SHA-256 is the bundle identity.
Signature state remains `unavailable` because no signing key is committed.

## Browser integration

The available Geographic Impact view now includes an accessible export panel.
Researchers prepare files on demand, inspect each filename, byte count and
digest, then download files individually through short-lived local object
URLs. Changing scope or evidence resets prepared state. The export path makes
no external request; the Chromium origin guard exercises preparation before
asserting the network audit.

## Commits

- `57967ae` — `feat(export): export geographic impact cells`
- `0c8ed31` — `feat(export): export geographic impact summaries`
- `c7d7b2e` — `feat(export): export impact methodology`
- `a3feb9f` — `test(export): verify geographic impact exports`

GitHits records `geo-impact-5.3` and `geo-impact-5.3.1` through
`geo-impact-5.3.4` are present. Two searches timed out after one bounded
attempt. One result proposed an insufficiently supported DuckDB-Wasm write
workaround and another produced Node-only provenance code from a weakly
related source; both received negative feedback and were not copied.

## Verification

- Full frontend suite: 477 passed, one skipped; 139 files passed, one skipped.
- Focused export unit and component tests: eight passed.
- TypeScript project check: passed.
- Production build and offline distribution verification: passed.
- Chromium map selection, no-WebGL fallback, export preparation and
  external-origin network guard: four passed.
- Provenance verifier: passed.
- `git diff --check`: passed.

The export retains the product's scientific language boundaries: baseline
occurrence evidence, Flickr candidate evidence, potential coverage
contribution, human-supported additional cells and release-ready occurrence
candidates only when the corresponding evidence and gates exist.
