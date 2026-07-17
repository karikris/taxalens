# Geographic Impact Task 9.1 report

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-9.1` — geographic verification milestones

Starting TaxaLens SHA: `47f016f2121092c2330516e5b1e059c918d435bb`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 9.1.1 | `935ddb7` | Added checksum-bound geographic audit dimensions without changing the primary owner-stratified sample or its probabilities. |
| 9.1.2 | `0eacecc` | Added deterministic geography-aware quality summaries and registered the unavailable zero-review snapshot in repository-backed storage. |
| 9.1.3 | `3469b1a` | Added a first-20 decisive-outcome import contract and synthetic capacity gate that never counts as retained evidence. |

GitHits records `geo-impact-9.1` and `geo-impact-9.1.1` through `geo-impact-9.1.3` record adopted and rejected patterns and licence notes. The 9.1.2 focused call timed out once and is truthfully marked unavailable; it was not retried within that subtask.

## Geographic audit design

The authoritative sample remains the existing deterministic, blind, stratified random sample of one observation per owner group:

- 145 owner groups in the rights-eligible pinned population;
- 49 selected owner groups;
- 0 repeated selected owners;
- unchanged selection seed, primary stratum IDs, inclusion probabilities, inverse weights, campaign ID and manifest identity.

The new blind reporting projection is bound to committed `geographic_impact_cells.parquet` SHA-256 `a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9`. It reports population and selected counts, including zero-take values, across continent, country, coordinate support, baseline-covered versus candidate-only cell, raw screening score band and query trust tier.

The 49 selected owners include four named continents, nineteen named country codes, one no-usable-geo item, one baseline-covered-cell item, forty-six candidate-only-cell items, all three declared raw score bands and three query tiers. Raw screening bands are historical model-similarity ranges, not probabilities or human labels. Missing or unsupported geographic comparison remains unavailable and is not biological absence.

## Geographic quality state

The committed geographic quality snapshot is deterministic and fail-closed:

- status: `unavailable`;
- assigned owner groups: 49;
- retained Flickr audit events: 0;
- consensus items: 0;
- decisive outcomes: 0;
- pending items: 49;
- scientific claim allowed: false.

Every geographic dimension retains the primary inclusion probability and inverse weight. Skip and Can’t view are counted only as non-scientific workflow outcomes and cannot enter a decisive or human-supported sample. Point estimates and intervals remain unavailable for empty strata.

## First milestone readiness

The import readiness artifact reports `ready_for_import`, not `achieved`:

- first decisive milestone: 20;
- current retained decisive outcomes: 0;
- remaining decisive outcomes: 20;
- bound campaign items available: 49.

A synthetic 20-item batch validates event IDs, campaign/item bindings, timestamps, image/question/campaign digests, decisive consensus provenance and positive inclusion probabilities. It is explicitly tagged `synthetic_fixture`, does not count toward the public milestone and is not committed as a review outcome.

## Verification

- Full Python suite: 903 passed.
- Task-focused sampling, geographic quality, milestone, repository-storage and campaign gates: 24 passed.
- Native Ruff check and format: passed.
- Flickr geographic verification handoff: rebuilt and deterministic after the campaign file gained geographic audit metadata.
- Repository B2 manifest: refreshed with both new verification artifacts and the updated handoff manifest.
- Provenance manifest verifier: passed.
- `git diff --check`: passed.

No review result was fabricated, no population-quality claim was enabled and the failure-discovery sample remains unsuitable for unweighted inference.
