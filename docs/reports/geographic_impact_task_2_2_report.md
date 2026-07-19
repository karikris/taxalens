# Geographic Impact Task 2.2 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `042f40de7bbb4deb87fa75efd53ee51922b323db`
- TaxaLens task push SHA: `53e0f4123a15f17e4a2e31ee0f78b2868044c967`
- Verified remote `origin/main`: `53e0f4123a15f17e4a2e31ee0f78b2868044c967`
- BioMiner geography artifact revision consumed: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner verification-campaign revision consumed: `94fa1f634ee3c63917c05d78181dd3cf9ceff940`
- BioMiner `main` observed at the completion gate: `282696d8d094a1af8c2be63ea0afa6d972e73e47`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

The handoff is commit-qualified. Later BioMiner reference-workflow changes do not alter the imported Flickr geography bytes, and unrelated staged and untracked BioMiner work was excluded.

## Imported Flickr geography

| Artifact | Rows | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `flickr_geography.parquet` | 13,501 | 769,162 | `a3c47a6f213191634f76655d859cdd8555a9b11a4e33a9041209eb23ba7c2bbf` |
| `flickr_geography_long.parquet` | 40,503 | 916,755 | `a38002d884cf5f96ad2027f691852ee0199ff08cec82574d640d06777aae8837` |
| `flickr_geography_verification.parquet` | 40,503 | 941,398 | `c414d2db442acc372029a4cc6d0a02d57a7f4e8495efd93ef2faa2499c32084d` |

The source has 13,501 geotagged Flickr candidates: 27 world, 54 country, 390 region, 5,094 city, 7,932 street and 4 unknown-precision rows. Its exact snapshot is `flickr:2026-07-15`; the grid is `hierarchical_global_grid` / `h3:4.5.0` at resolutions 3, 5 and 7.

The long form emits one row per candidate per declared resolution. It contains 34,374 precision-supported rows and 6,129 explicit unsupported rows whose cell IDs remain null. Supported counts reconcile to 13,416 at resolution 3, 13,026 at resolution 5 and 7,932 at resolution 7. No country or admin value was inferred because those fields are unavailable in the committed snapshot.

## Verification identity and scientific state

The verification-enriched artifact binds the Flickr source photo, source-record hash, duplicate group, observation group, owner group, geographic cluster, dataset split, sample design, campaign item and consensus fields without changing geographic semantics.

The current committed public state is:

- 13,501 Flickr candidate photos;
- 49 photos included in the Flickr audit campaign;
- 49 pending campaign photos;
- 0 reviewer-assigned photos;
- 0 retained human-reviewed photos;
- 0 human-supported photos;
- 0 decisive reviews.

Campaign membership and machine screening are not human outcomes. `Skip` and `Can't view` cannot become human support. Release readiness is deliberately not derived by this handoff.

## Precision regression coverage

The regression suite covers world, country, region, city, street, unknown precision, invalid coordinates and missing/no-geo input. It rejects false local cells, keeps unsupported finer cells null and preserves source geography warnings. Invalid coordinates and unavailable geography are represented as distinct fail-closed states.

## Commits

- `3b1307f` — `feat(replay): import Flickr geographic evidence`
- `f85e040` — `feat(geography): normalize Flickr cell evidence`
- `a7a56f7` — `feat(geography): bind Flickr verification identity`
- `53e0f41` — `test(geography): preserve Flickr coordinate precision`

GitHits records `geo-impact-2.2`, `geo-impact-2.2.1`, `geo-impact-2.2.2`, `geo-impact-2.2.3` and `geo-impact-2.2.4` are present. The task-level attempt did not return within two bounded waits and was terminated. Each record truthfully uses `githits_status: unavailable`; no repository result or licence conclusion was fabricated.

## Gate results

- Full Python suite: 840 passed.
- BioMiner Flickr geography policy suite: 8 passed.
- Flickr handoff verifier: 13,501 committed candidate-geography rows verified.
- Long-form reproducibility check: 40,503 rows and 34,374 supported rows verified.
- Verification binding check: 13,501 photos, 49 campaign photos and 0 reviewed photos verified.
- Repository-storage check: 6 tables, 4 campaigns and 82 verification items.
- Truthful judge bundle: 30 artifacts, 36 records and 3 media descriptors.
- Native Ruff and format: 120 files clean; 46 retained source-locked compatibility findings reported separately.
- Provenance verifier: passed.
- BioMiner boundary verifier: passed with expected warnings for the historical prototype pin and unrelated upstream work.
- `git diff --check`: passed.

Flickr rows remain candidate evidence. Zero human outcomes means there are no human-supported additional cells and no release-ready occurrence candidates at this task boundary.
