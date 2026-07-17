# Geographic Impact Task 8.1 report

## Outcome

Task 8.1 adds adversarial unit and integration coverage for the deduplicated provider union, browser full-outer cell comparison, shared bubble scale and geographic drilldown state. The tests do not add or promote scientific evidence.

## Version-control context

- Starting TaxaLens SHA: `27dcce46deb0c8d4fc777b2f212f2f5f8424cd27`
- Required branch: `main`
- BioMiner baseline artifact origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr artifact origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- GitHits task attempt: unavailable after one 120-second timeout; no retries were made within the task.
- Unrelated modified and untracked workspace files were left untouched.

## Subtasks

### 8.1.1 Provider union

Commit: `6a1de4f` (`test(geography): cover provider union`)

- Proves GBIF-only and iNaturalist-origin-through-GBIF rows form a disjoint canonical partition.
- Proves provider relationship, delivery path, identity method and source-dataset provenance reconcile.
- Proves provider audit fields remain invariant across resolution 3, 5 and 7 projections.
- Retains direct iNaturalist delta as unavailable because no committed direct snapshot exists.

### 8.1.2 Browser cell joins

Commit: `f913f17` (`test(impact): cover browser cell joins`)

- Rejects source cells absent from the materialized impact artifact.
- Rejects materialized cells absent from source evidence.
- Rejects selected rollups that differ from browser cell totals.
- Retains the seven-key scoped full-outer join, cancellation and selected-column checks.

### 8.1.3 Bubble scale

Commit: `afbb040` (`test(map): validate bubble scaling`)

- Tests the square-root count relationship above the visibility floor.
- Proves baseline and Flickr evidence use one shared absolute domain.
- Tests the intentional hidden-zero and positive minimum-radius behavior.
- Tests deterministic legend values and invalid finite-radius rejection.

### 8.1.4 Drilldown state

Commit: `aeef0f3` (`test(map): cover geographic drilldown`)

- Covers Global → Asia → India → Global navigation.
- Preserves unrelated metric query state.
- Avoids duplicate history entries for the active scope.
- Rejects unknown hierarchy identities before changing the URL.

## Gate follow-up

The complete gate identified two pre-existing integration issues and one test-harness timing issue:

- repository-backed B2 receipts did not yet include the latest committed geographic impact artifact bytes;
- native Ruff was available in `.venv/bin` but the isolated Python subprocess required that directory on `PATH`;
- the code-split Agent route used Testing Library's one-second default wait, which passed in isolation but timed out in the full suite.

The deterministic repository-storage generator refreshed only the two affected manifests. The provider test was formatted with the pinned Ruff binary. The App integration test now uses a bounded five-second query wait and ten-second test timeout while preserving the production Suspense boundary.

## Verification

- `PATH="/home/toffe/github/karikris/taxalens/.venv/bin:$PATH" .venv/bin/python -m pytest -q` — **895 passed**.
- `npm --prefix apps/web test` — **541 passed, 1 skipped** across 154 files.
- `npm --prefix apps/web run check` — passed.
- `PATH="/home/toffe/github/karikris/taxalens/.venv/bin:$PATH" .venv/bin/python -m pytest tests/test_geographic_contracts.py tests/test_geographic_contract_parity.py -q` — **35 passed**.
- `npm --prefix apps/web test -- src/data/geographicContractParity.test.ts` — **3 passed**.
- `.venv/bin/python scripts/build_repository_storage.py --check` — passed; 6 tables, 4 campaigns and 82 items.
- `.venv/bin/python scripts/verify_provenance.py` — passed.
- `git diff --check` — passed.

## Scientific state

No retained human outcome was introduced. Candidate-only, human-supported and release-ready states remain distinct. Skip and Can't view outcomes remain excluded from contribution. No direct iNaturalist comparison was fabricated.

