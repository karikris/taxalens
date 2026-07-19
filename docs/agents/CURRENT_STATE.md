# Current TaxaLens state and active-goal safety

## Observed repository baseline

Generated from public `karikris/taxalens` on 2026-07-17.

- Default branch: `main`
- Latest observed commit:
  `acd915da6b7545c110e0261b0c9edbe105d2206f`
- Commit subject: `docs(export): report geographic impact exports`
- Active goal family: Geographic Impact Lens
- Primary observed Codex session:
  `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary observed model: `configured-model`, reasoning `xhigh`
- Public replay: `https://karikris.github.io/taxalens/`

This is a GitHub baseline, not a statement about uncommitted local work. The
local worktree, active process state, and current task report are authoritative.

## Active-goal protocol

Before touching a file:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
git diff --stat
git diff --cached --stat
```

Inspect:

```text
docs/reports/geographic_impact_*
docs/architecture/geographic-impact-lens.md
docs/architecture/baseline-provider-union.md
provenance/githits.jsonl
HUMAN_DECISIONS.md
UPSTREAM_BIOMINER.md
```

`AGENTS.md` is ignored by the current `.gitignore`. A local file may exist even
though GitHub returns 404. Do not overwrite it without comparing the local
content.

### Never do during another active session

- reset, restore, clean, stash, rebase, merge, or switch branches;
- pull onto a dirty worktree;
- mass-format or rename active files;
- stage or commit another session's work;
- delete generated impact, bundle, map, review, or deployment artifacts;
- rebuild snapshots in place;
- modify BioMiner's working tree;
- start an overlapping hosted deployment or artifact materialization.

Stop and report an unavoidable overlap.

## Active Geographic Impact goal

Committed `main` has completed through **Task 5.3 — geographic impact exports**.

Confirmed committed behavior includes:

- accepted Geographic Impact Lens ADR;
- a separate legacy Flickr Workload Map;
- a canonical baseline provider union;
- precision-aware Flickr geography;
- verified offline country hierarchy;
- full-outer spatial-cell impact materialization;
- global, continent, country, and admin1 drilldown;
- MapLibre/offline distribution with no external map dependency;
- synchronized accessible details and table;
- potential, human-supported, and release-ready contribution tiers;
- same-resolution nearest-baseline distance;
- temporal contribution with unavailable states;
- evidence-derived data-deficiency reasons;
- deterministic JSON/CSV/Parquet/methodology exports plus SHA-256 manifest.

Latest Task 5.3 verification reported:

```text
frontend suite        477 passed, 1 skipped
focused export tests  8 passed
TypeScript check      passed
production build      passed
Chromium map/network  4 passed
provenance verifier   passed
git diff --check      passed
```

The goal plan's next committed area after Task 5.3 is Phase 6:

```text
join current human-review state
add record-level Geographic Impact context in Evidence Lens
bind map contribution to QualitySnapshot and release semantics
```

Confirm locally before acting; the active Codex session may already have
uncommitted Phase 6 work.

## Verification workflow state

The prior Verification goal is implementation-complete and hosted. It provides:

- campaign-driven Flickr and reference review;
- checksum-gated media;
- append-only IndexedDB events;
- Supabase/B2 adapter contracts and repository mirror;
- consensus, conflicts, adjudication;
- audit and failure-discovery sampling;
- statistical quality snapshots;
- BioMiner-compatible exports;
- Configured model verification tools and stored replay.

The completion report states **82 campaign assignments and zero retained human
outcomes**. Therefore:

- decisive review coverage remains zero;
- target-precision interval remains unavailable;
- reviewed geographic contribution remains zero;
- release-ready occurrence contribution remains zero;
- review contracts and synthetic fixtures are not human evidence.

Do not fabricate progress to improve the map or presentation.

## Product architecture

```text
taxalens/                  Python CLI, facade, replay server, verification
apps/web/                  React product, DuckDB-Wasm, MapLibre, tests
packages/replay/           pinned BioMiner compatibility/replay contracts
packages/contracts/schema/ JSON Schema contracts
demo/fixture/              closed checksum-verified judge bundle
demo/repository_storage/   credential-free Supabase/B2-shaped mirror
provenance/                migration, GitHits, model and source evidence
docs/architecture/         accepted decisions
docs/reports/              task and phase reports
submission/                judge-facing AI and provenance evidence
```

## Package/runtime baseline

Python:

```text
Python >=3.11
uv >=0.11
jsonschema
Polars/PyArrow/H3 in optional groups
DuckDB in tests/replay
```

Web:

```text
Node >=22.12
React 19
TypeScript 7
Vite 8
Vitest 4
Playwright 1.61
DuckDB-Wasm 1.32
MapLibre 5.24
Supabase JS 2.110
OpenAI JS 6.47
```

Use pinned lockfiles and package versions. Do not upgrade dependencies during
an unrelated active task.

## Upstream BioMiner boundary

TaxaLens uses multiple exact BioMiner pins for different historical artifacts.
Do not collapse them into one “current BioMiner” identity.

Current accepted rules:

- BioMiner remains the scientific engine.
- TaxaLens owns product, verification, replay, browser analytics, exports, and
  judge experience.
- Broad source copying is frozen.
- New integration order:
  committed artifact → versioned schema → thin adapter → stable command → small
  shared package → copied source only after explicit rejection of earlier paths.
- Family-first output is diagnostic only.
- Web and analyst consumers use the TaxaLens facade.

BioMiner's adaptive GBIF fast-start work has advanced beyond some TaxaLens
historical decisions. Do not automatically lift current BioMiner semantics into
the pinned TaxaLens prototype. Revalidate exact contracts, rights, evidence
maturity, and source SHAs in a dedicated migration task.

## Stale or contextual documentation

- README accurately describes the public replay and honest zero-human-outcome
  state, but exact artifact counts may lag the active Geographic Impact goal.
- Historical verification reports remain immutable evidence of their ending
  SHA; do not rewrite them with current counts.
- `HUMAN_DECISIONS.md` is authoritative until explicitly amended, even when
  current BioMiner main has evolved.
- General prose never overrides accepted ADRs or current schemas/tests.
