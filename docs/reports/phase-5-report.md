# Phase 5 report — executable research observatory

## Outcome

Phase 5 turns Observatory into an executable, artifact-bound inspection surface for the submitted
*Papilio demoleus* pilot. It renders all thirteen evidence stages, starts a pinned DuckDB-Wasm worker
only after explicit activation, executes eight real SQL operations over four exact BioMiner Parquet
artifacts, and exposes both plain-language and engineering inspection modes.

The phase also reports only reproducible work-avoided counters and traces the real awaiting-review
replay record through every contributing stage state and verified artifact. No view promotes query
matches, geographic candidates, missing model output, or the diagnostic replay record to scientific
evidence.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Starting SHA after Phase 4 reporting: `098034999439be230592da3fa639ef97b8196fd6`
- Task 5.1: `adfc154a986a3a49b4eb46ac074d67c04f32947a` — visualize the evidence pipeline
- Task 5.2: `84bb17da84b98cc1d5483a5d01bb8b9748c4709e` — execute judge replay analytics
- Task 5.3: `9ff7f2dc4438457a57d370bf25aac46377e35899` — add engineering inspection
- Task 5.4: `8a6fd8d392848ca2c39d49c58d117b23a44aaefc` — show measured work avoided
- Task 5.5 and pushed Phase 5 task SHA:
  `ad322da77d28bf46641a138e7caa02207a601b44` — trace evidence lineage

The independent provenance-maintenance commit
`c4f4abb4fccbd90cde51b7c70498a8f26f082a8b` landed between Tasks 5.4 and 5.5 and was preserved.
It was not folded into or attributed to a numbered Phase 5 implementation task.

At the Phase 5 gate, local `HEAD` and `origin/main` both resolved to
`ad322da77d28bf46641a138e7caa02207a601b44`.

## Thirteen-stage evidence pipeline

The pipeline is an ordered semantic list rather than a quantity-conserving Sankey. Each stage shows
its stable sequence, name, status, measured count, source unit, interpretation, and fixture section.
The interface preserves unlike units and distinguishes a verified numeric zero from unavailable
producing evidence.

The displayed path covers Trusted Registry through Final Evidence. It retains the fixture's actual
metadata counts, including 76,485 Flickr query hits, 13,501 canonical photos, 76 located clusters,
five regional competitor hypotheses, and 838 eligible source-media candidates. YOLOE, full-frame
BioCLIP, scoring, calibration, comments, and final scientific evidence remain explicitly unavailable
or awaiting review.

Status is repeated through words, markers, border treatment, and color. The ordered textual path is
the primary representation at every viewport.

## Real browser analytics

Task 5.2 imported only the four Parquet artifacts attested by the pinned BioMiner geographic-workload
manifest. Their combined verified size is 1,647,550 bytes:

- Flickr query hits: 76,485 rows;
- Flickr geography: 13,501 rows;
- geographic assignments: 13,501 rows;
- geographic clusters: 77 rows.

The evidence facade checks the import receipt, byte count, SHA-256 digest, Parquet magic, producer
SHA, and cross-references before returning copied bytes to the lazy analytics boundary. DuckDB-Wasm
package 1.32.0 runs pinned engine v1.4.3 in a browser worker. Its signed Parquet extension is vendored
at the exact verified version and loaded from the application origin with extension auto-install and
auto-load disabled.

The replay executes and explains eight operations:

1. physical-query hash deduplication — 556 rows;
2. logical association fan-back — 76,485 rows;
3. source-ID equality hash join — 76,485 rows;
4. duplicate association anti-join — 13,501 rows;
5. spatial cluster assignment join — 13,501 rows;
6. candidate-set union — six rows;
7. replay-stage aggregation — six rows;
8. diagnostic evidence assembly — one row.

The interface calls the source-ID operation a hash join only after DuckDB `EXPLAIN` reports
`HASH_JOIN`, and it verifies `ANTI` for the duplicate operation. Matrix scoring is neither executed
nor described as a hash join. Connections, registered files, and the worker are closed on every
completion or failure path.

## Research and Engineering modes

Research mode is the default disclosure level. For each operation it explains what occurred, why it
was necessary, records entering, records leaving, and the user consequence.

Engineering mode is available through a labelled, arrow-key-operable tab set. It reports the exact
operation, keys, cardinality, rows, null-key output rows, elapsed execution time, verified source
artifact bytes, measured Parquet row groups, fresh-worker cache boundary, artifact ID, checksum,
producer SHA, observed plan operators, and full `EXPLAIN` text. Artifact sizes are explicitly not
claimed as bytes scanned, JSON is not described as a Parquet partition, and no persistent cache is
invented.

## Measured work avoided

The pinned BioMiner discovery ledger defines API requests avoided by deduplication as the sum of
additional query hits per canonical source photo. DuckDB reproduces that definition over the exact
query-hit Parquet and independently cross-checks it against the replay's input and retained counts.

The resulting 62,984 request-equivalent query hits avoided and 62,984 duplicate hits collapsed are
shown with accessible known-range meters, exact 76,485-before and 13,501-retained text, formula,
artifact checksum, and producer SHA.

The fixture has no ledgers proving downloads avoided, inference avoided, embeddings reused,
completed-work resume anti-joins, or remote handoff reads avoided through verified local-cache reuse.
All five requested categories remain visible as `not instrumented`. Zero work executed is not
relabelled as work avoided, and no estimate, rate, cost, or time saving is shown.

## Selected-record lineage

The facade now exposes a read-only inventory projection for all 22 checksum-verified artifacts. A
pure lineage model creates explicit artifact-to-stage and stage-to-record edges for the real
`papilio-demoleus-pilot-awaiting-review` hero.

Selecting that final replay record with a native keyboard-operable button computes its complete
upstream closure with a queue and visited set. The UI then highlights all thirteen stage states and
twelve contributing artifacts, announces both counts, and repeats the relationship in text with
artifact path, related stage labels, checksum, producer SHA, and verification status.

Unavailable stages contribute only their explicit missing-evidence state and correctly contribute no
fabricated artifact. The selected record remains a diagnostic replay boundary awaiting human review;
the fixture still contains zero final scientific evidence records.

## Phase gates

The final Phase 5 gate passed:

- `uv sync --locked`;
- `uv run --locked pytest -q` — 627 passed;
- `npm ci` and `npm audit --audit-level=low` — zero vulnerabilities;
- strict TypeScript project check;
- Vitest — 31 passed across twelve files;
- production Vite build and byte-exact static fixture verifier;
- Chromium Playwright — six flows covering same-origin static replay, reduced motion, keyboard
  navigation, bounded mission launch, real DuckDB-Wasm execution, query-plan inspection, Research and
  Engineering modes, accessible meters, selected-record lineage, and mobile overflow;
- no external HTTP request during the real analytics replay;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification against the pinned SHA with its snapshot written outside the
  repository;
- `uv lock --check`, GitHits JSONL parsing, and `git diff --check`.

The real analytics and fully highlighted lineage were rechecked at 390×844 with no horizontal
overflow. Reduced-motion rules cover the artifact highlight transition.

## BioMiner boundary decision

The pinned BioMiner repository remained at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Phase 5 imported the four exact manifest-attested
Parquet artifacts and reproduced one narrow discovery metric definition. It did not modify BioMiner
or copy acquisition, model execution, reporting, storage, or evaluation subsystems.

BioMiner's pre-existing untracked configuration, documentation, query-term, and log paths remained
untouched and were not treated as evidence.

## Accepted limitations and Phase 6 handoff

- The submitted fixture contains no rights-cleared image or licensed thumbnail, so Phase 6 must show
  an explicit media-unavailable state rather than substituting unrelated imagery.
- No YOLOE detection, mask, full-frame transformation, BioCLIP embedding, candidate visual score,
  calibrated decision, reviewed comment, or final scientific evidence record exists for this pilot.
- Five requested workflow-efficiency counters remain not instrumented because the necessary ledgers
  or receipts are absent.
- The selected lineage record proves diagnostic traceability, not a species identification or
  occurrence.
- The DuckDB worker and Wasm payload remain lazy but materially increase the optional analytics
  download when the user runs it.

Phase 6 must build the first evidence lens from the same facade and lineage contracts. It may expose
discovery provenance and explicit unavailable computer-vision states, but it must not source a hero
image, segmentation, embedding identity, candidate score, or scientific conclusion that the verified
bundle does not contain.
