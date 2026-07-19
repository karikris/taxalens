# Data, replay, storage, and artifact boundaries

## Data architecture

Use:

```text
JSON Schema          wire contracts
Polars/Parquet       durable analytical artifacts
DuckDB/DuckDB-Wasm   bounded analytics and joins
JSON                 small manifests/configuration/reports
IndexedDB            local append-only review evidence
Supabase PostgreSQL  optional collaborative control state
Backblaze B2         optional immutable/private objects
```

Avoid pandas and CSV as internal durable formats. CSV is an explicit export
boundary only.

## Judge bundle

The judge bundle is a closed, fingerprinted product input.

Every artifact entry should carry:

- role/logical name;
- path;
- media type;
- byte count;
- physical SHA-256;
- schema/version;
- source repository and commit;
- evidence maturity;
- rights/attribution identity;
- availability;
- expected counts where appropriate.

Rules:

- verify all bytes before display or analysis;
- fail closed on missing, stale, incompatible, or orphaned IDs;
- do not invent missing sections;
- historical bundle versions require explicit migration;
- fixture-specific exact counts belong in the fixture validator, not general
  product logic.

## Product facade

UI and analyst code use stable facade methods such as:

```text
load_run
load_pipeline
load_evidence_record
load_candidate_comparison
load_reference_evidence
load_geography
load_verification
load_dashboard_summary
load_evaluation_summary
load_lineage
export_evidence
```

The facade:

- validates runtime schemas;
- returns provenance and availability;
- separates fixture validation from general product behavior;
- does not reimplement BioMiner scientific policy;
- does not expose provider/worker secrets.

Components must not search hard-coded artifact IDs.

## Replay

Public replay requirements:

```text
no login
no Flickr key
no OpenAI key
no Supabase account
no B2 account
no GPU
no model download
```

It uses:

- committed artifacts;
- checksum verification;
- static product build;
- IndexedDB/local review events;
- stored GPT-5.6 tool replay;
- local deterministic exports;
- resettable state.

It makes no write to BioMiner, Supabase, B2, or another remote service.

## Repository storage mirror

The repository mirror models cloud boundaries without claiming a live export.

Supabase-shaped snapshots may contain:

- campaigns;
- items;
- immutable configuration;
- empty mutable reviewer/event tables when no outcomes exist.

B2-shaped inventory points to committed bytes and checksums.

Do not add users, review events, signed URLs, or cloud receipts that do not
exist.

## Review persistence

Repository interface:

- load campaigns/items/events;
- append event;
- project current decisions/consensus;
- export receipt;
- clear local campaign where permitted.

Adapters:

- in-memory tests;
- IndexedDB local;
- Supabase collaborative.

All adapters pass the same contract tests. Sync is idempotent by event ID.
Scientific review evidence is append-only; cached projections are disposable.

## Geographic artifacts

Keep source and derived artifacts distinct:

```text
baseline occurrence union
precision-aware Flickr geography
country hierarchy
impact cells
impact summaries
impact manifest
verification projection
quality snapshot
release decisions
```

Impact materialization must preserve:

- full-outer cell join identity;
- provider-union semantics;
- matched/baseline-only/candidate-only cells;
- exact unavailable fields;
- source and output checksums;
- source commits;
- rights identity.

## Browser analytics

DuckDB-Wasm work must be:

- scoped by target/run/snapshots;
- projection- and predicate-bounded;
- cancellable when selection changes;
- cached by exact semantic query identity;
- kept off the main thread where practical;
- preaggregated before converting to JavaScript objects.

Do not load raw large datasets into component state.

## Exports

Current Geographic Impact export boundary may include:

- selected-scope canonical JSON;
- selected-scope CSV;
- verified full-source Parquet;
- selected-scope summary;
- methodology/provenance;
- unsigned SHA-256 manifest.

Rules:

- exact scoped labels;
- deterministic ordering and serialization;
- unavailable remains null/status, not zero;
- local browser object URLs are short lived;
- export has no upload, review, release, or publication side effect;
- physical checksum proves bytes, not scientific truth;
- signature unavailable remains explicit.

## Static map distribution

- Bundle country boundaries and style.
- No external tiles, fonts, sprites, analytics, or map APIs in judge replay.
- Verify external-origin network guard.
- Provide no-WebGL fallback with the same evidence table and summaries.
- Keep map data rights and attribution in the bundle.

## Secrets and runtime data

Never commit:

- API keys, tokens, DSNs, service roles;
- signed URLs;
- private/restricted source media;
- IndexedDB/local browser databases;
- `node_modules`;
- build/deployment output outside declared source artifacts;
- caches or Playwright reports;
- temporary object URLs;
- unverified upstream runtime data.
