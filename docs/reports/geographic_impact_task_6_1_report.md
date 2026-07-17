# Geographic Impact Lens Task 6.1 Report

## Scope

Task 6.1 integrates append-only human-review maturity with the Geographic
Impact Lens while preserving the committed impact artifacts as immutable
evidence. TaxaLens started the task on `main` at
`acd915da6b7545c110e0261b0c9edbe105d2206f`.

The committed public replay still contains zero retained human outcomes, no
quality snapshot and no occurrence-release decision. The implementation does
not invent any of them.

## Review projection

The new pure projection accepts multiple verification campaigns, their exact
items and append-only event ledgers, precision-aware spatial bindings, quality
snapshots and occurrence-release decisions. It projects deterministic
consensus before calculating:

- assigned campaign items;
- decisively reviewed target-positive and non-target items;
- uncertain outcomes;
- media failures;
- pending items;
- skipped items;
- quality-valid reviewed items;
- population-quality-eligible reviewed items;
- targeted failure-discovery reviewed items; and
- release-ready items with complete retained gates.

Sampling purpose, representativeness and quality-estimation eligibility remain
attached to every item projection. A targeted failure-discovery result can be
a valid reviewed example, but it is explicitly excluded from unweighted
population inference.

Skip and Can't view are tested workflow outcomes. Neither is decisive,
human-supported or release-ready.

## Public audit binding

The browser verifies and loads two same-origin committed assets:

- the 293,048-byte Flickr audit campaign packet with SHA-256
  `c9efb76f6c576b217aa7fd7469f49d671d81e3b248b2ab735d4fb874be6b61bc`;
- the 941,398-byte precision-aware Flickr geography verification Parquet with
  SHA-256
  `c414d2db442acc372029a4cc6d0a02d57a7f4e8495efd93ef2faa2499c32084d`.

The campaign size is validated against its own sampling plan rather than a
product literal. The Parquet query selects only campaign ID, item ID,
resolution, supported spatial cell, assignment count and committed review
state. Raw candidate media or full raw occurrence rows do not enter the map
projection.

The representative Flickr audit is available. No committed
failure-discovery campaign packet is present, so its public map state remains
explicitly unavailable rather than fabricated.

## Local refresh semantics

The IndexedDB repository emits a typed same-page ledger-change event only
after a successful append or clear transaction. Idempotent duplicate appends
emit no second event. The map hook responds by re-reading the immutable ledger
and rebuilding consensus; it never increments counters directly from a button
click.

The local overlay subtracts the committed campaign state from each exact cell
before adding the local projection. This prevents double counting retained
outcomes. Non-campaign candidates remain pending. The overlay is reversible
and exists only in browser memory.

Local consensus can update pending, positive, negative, uncertain, media
failure and skipped layers. It cannot change `release_ready_count` or
`release_ready_additional_cell`; those fields remain bound to retained quality
and occurrence-release evidence.

The main geographic query completes before the review-binding query starts,
so the replay does not run two DuckDB-Wasm databases concurrently.

## Product state

The lens now contains:

- an exact human-verification progress panel;
- distinct campaign, assignment, review, quality and release denominators;
- candidate, baseline, any-human-review and release-ready maturity filters;
- synchronized filtering across the map, exact table, selected-geography
  details and country ranking;
- exact zero-result announcements;
- native keyboard-operable radio controls;
- media-failure and skipped columns in the accessible table; and
- visible local-overlay loading, unavailable, failure and available states.

Transient maturity filters do not silently alter exports. Exports continue to
contain the complete selected geographic scope until evidence-mode identity is
added to the export contract.

## Commits

- `ebd6829` — `feat(impact): join human verification state`
- `a17846b` — `fix(map): expose geographic review progress`
- `1a7ced3` — `feat(map): filter geographic evidence maturity`
- `a6945c0` — `feat(map): refresh impact from local verification`

GitHits records `geo-impact-6.1` and `geo-impact-6.1.1` through
`geo-impact-6.1.4` are present. The density search supplied useful semantic
UI patterns from MIT and Apache-2.0 projects. The other bounded searches timed
out or returned no relevant source. No external implementation was copied.

## Verification

- Full frontend suite: 493 passed, one skipped; 144 files passed, one skipped.
- Focused review, overlay, repository, filter and hook tests: 20 passed.
- TypeScript project check: passed.
- Production build and offline distribution verification: passed.
- Provenance verifier: passed.
- BioMiner boundary verifier: passed and recorded
  `provenance/biominer_state/biominer_boundary_20260717T183000Z.json`.
- `git diff --check`: passed.

The existing Chromium table journey could not start in this container because
the installed headless Chromium binary is missing the host library
`libnspr4.so`. All three attempted cases stopped before creating a browser
page; this is an environment blocker, not a reported test pass. Browser
execution remains to be rerun when the host dependency is restored.

## Upstream boundary

The review binding continues to consume the pinned BioMiner Flickr geography
handoff at `75461d9c065af0cd96b41cd1f845c2e920f7ae34`. During the final boundary
check the concurrently changing local BioMiner checkout was at
`c47a004bc2bcc11759df51fc8851d3b1b74788ee`; it was not consumed. Its untracked
working files were preserved.

The scientific boundary remains: Flickr evidence is a hypothesis until review
and configured occurrence-release gates pass. Local review adds no scientific
release claim.
