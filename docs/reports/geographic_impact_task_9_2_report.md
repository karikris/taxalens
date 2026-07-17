# Geographic Impact Task 9.2 report

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-9.2` — real human geographic impact study readiness

Starting TaxaLens SHA: `1440596cf4403af61ba8d57481feacda7c4e3044`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 9.2.1 | `099d5bd` | Defined the fixed moderated Geographic Impact usability protocol, measures, answer key, privacy boundary and pending-data rule. |
| 9.2.2 | `8511e3d` | Added a closed JSON Schema and empty raw study packet that reject synthetic participants and direct identifiers. |
| 9.2.3 | `c7727c0` | Added deterministic semantic validation and descriptive reporting with fail-closed empty-sample output. |

GitHits records `geo-impact-9.2` and `geo-impact-9.2.1` through `geo-impact-9.2.3` are present with licence notes. No focused query returned a qualifying external implementation; one timed out and the others truthfully record no quality-threshold match. The implementation therefore extends TaxaLens local study and contract patterns without copying external code.

## Study readiness

The protocol measures the requested workflow:

1. time to identify a country coverage gap;
2. time to find an inspectable candidate record;
3. time to inspect provenance;
4. time to begin verification;
5. evidence-state interpretation accuracy;
6. confidence and observed errors.

The data instrument requires consent, a salted participant-ID hash, broad experience/role categories, the build fingerprint, a no-external-map-request environment, five ordered task observations, active time, action/help counts, predeclared errors, interpretation answers and 1–5 confidence. It rejects synthetic participants and additional identity fields. Study observations cannot become verification events or taxonomic labels.

## Committed evidence state

The raw packet and summary both remain `pending_human_data`:

- genuine human participant count: 0;
- retained study sessions: 0;
- analysis-eligible sessions: 0;
- human usability measured: false;
- interpretation accuracy: unavailable;
- task timing, action and confidence aggregates: unavailable;
- human time-savings claim allowed: false;
- causal product-impact claim allowed: false.

The report is bound to the raw packet, schema, TaxaLens build and impact artifact digests. Synthetic fixtures test validation and aggregation only and are not present in the committed human-session array.

## Verification

- Full Python suite: 908 passed.
- Focused contract/report/repository tests: 9 passed.
- Ruff lint and format: passed.
- JSON Schema and raw JSON parsing: passed.
- Repository-backed B2 manifest includes the raw and summary artifacts.
- Provenance manifest verifier: passed.
- `git diff --check`: passed.

## Human input gate

No participant, timing, confidence, error or usability result was fabricated. The study remains pending until genuine consented sessions are supplied, reviewed for privacy and approved for publication.
