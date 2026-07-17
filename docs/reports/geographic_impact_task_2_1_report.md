# Geographic Impact Task 2.1 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `26656db5322491ba27324599fe3ae23909ce7389`
- TaxaLens task push SHA: `7500cb5cc904b7590b6cad0c2145281d5872ebed`
- Verified remote `origin/main`: `7500cb5cc904b7590b6cad0c2145281d5872ebed`
- BioMiner revision consumed: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner `main` observed after the handoff was frozen: `c666eef04ef7f292562ef51acf54f05b8e91c6ab`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `gpt-5.6-sol`
- Reasoning effort: `xhigh`

The later BioMiner commits add reference-workflow performance evidence and do not alter the geographic builders or the imported bytes. The handoff deliberately retains the exact consumed commit instead of following ambient upstream `HEAD`.

## Imported baseline handoff

| Artifact | Rows | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `geographic_occurrence_evidence.parquet` | 57,603 | 867,794 | `1387f3c9967d322e537e9f2079b58641543707db863d2057c1caa4408d208a47` |
| `taxon_geographic_spread.parquet` | 16,678 | 513,562 | `46f38228cb5e7ba58f5f38f79a38dd87ae8fab80cf987e916f620d5cc4b9e83c` |
| `taxon_geographic_summary.parquet` | 1 | 15,030 | `838d8eef1c88757822b850a0f24ffc306818e1d90bf4ca18f6d78924d6c96176` |
| `geographic_qa_findings.parquet` | 1 | 1,508 | `5424aef1f921e67049da8484ee99b303701cf783ede76ede8e5af68767c5dce2` |

The spread and occurrence-evidence files were BioMiner runtime outputs that were ignored in the upstream repository. TaxaLens does not misrepresent them as committed upstream Git objects: it records their exact checksums, their producing code revision, and the fact that the imported bytes are now committed in TaxaLens. The required summary, QA file, and summary manifest were generated through the exact pinned BioMiner builder with its versioned default policy.

The handoff is scoped to:

- project `taxalens-papilio-demoleus-judge-replay`;
- run `papilio-demoleus-pilot-20260715`;
- accepted taxon `gbif:1938069` (`Papilio demoleus`);
- registry `butterflies-v2-20260712`;
- baseline snapshot `gbif-occurrence-search-20260715`;
- grid `hierarchical_global_grid` / `h3:4.5.0`;
- resolutions 3, 5 and 7.

## Adapter and validation

The TaxaLens adapter adds only immutable project, run, snapshot, grid, origin and import-manifest fields. It proves the remaining spread, occurrence-evidence, summary and QA columns are value-equal to the imported BioMiner frames. Source dataset identity and citation, range-inference eligibility, preserved-specimen and fossil counts, geospatial issues, date ranges, known-range roles, evidence confidence, and coordinate-uncertainty values remain unchanged.

Fail-closed coverage rejects:

- wrong accepted taxon;
- wrong registry;
- missing baseline snapshot;
- changed artifact checksum;
- unsupported spatial resolution;
- blank provider, dataset, query or snapshot provenance;
- inconsistent source manifests;
- fatal geographic QA.

The repository-storage mirror now inventories all new handoff bytes. It contains 81 committed object entries and requires no Supabase or Backblaze B2 credentials for the replay.

## Commits

- `9285d2e` — `feat(replay): import baseline geographic spread`
- `c096c97` — `feat(replay): adapt baseline occurrence evidence`
- `f3cdf49` — `test(replay): validate baseline geographic handoff`
- `a43773b` — `chore(replay): register baseline geography storage`
- `7500cb5` — `style(replay): format baseline geography importer`

GitHits records `geo-impact-2.1`, `geo-impact-2.1.1`, `geo-impact-2.1.2` and `geo-impact-2.1.3` are present. The service did not return within the bounded task-level attempt, so all four records truthfully use `githits_status: unavailable`; no result or licence was fabricated.

## Gate results

- Full Python suite: 826 passed.
- Baseline adapter and contract selection: 48 passed in the focused gate.
- Baseline handoff regression file: 12 passed.
- Import check: passed for six artifacts.
- Repository-storage check: passed; 6 tables, 4 campaigns and 82 verification items.
- Truthful judge bundle: passed; 30 artifacts, 36 records and 3 media descriptors.
- Native Ruff and format: 113 files clean; 46 retained source-locked compatibility findings reported separately.
- Provenance verifier: passed.
- BioMiner boundary verifier: passed with expected warnings for the retained historical prototype pin and unrelated upstream untracked content.
- `git diff --check`: passed.

No human outcomes were invented. Baseline evidence remains a selected snapshot, and missing evidence remains unknown rather than biological absence.
