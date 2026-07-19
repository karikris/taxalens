# Testing, deployment, and release

## Environment

Python:

```bash
uv sync --locked
```

Web:

```bash
cd apps/web
npm ci
```

Current minimums:

```text
Python >=3.11
uv >=0.11
Node >=22.12
npm >=9
```

Use pinned lockfiles. Do not upgrade dependencies in unrelated work.

## Principal commands

Python and artifacts:

```bash
uv run --locked pytest
uv run --locked python scripts/import_biominer_prototype_artifacts.py --check
uv run --locked python scripts/import_biominer_analytics.py --check
uv run --locked python scripts/build_repository_storage.py --check
uv run --locked python scripts/verify_demo.py
uv run --locked python scripts/verify_provenance.py
```

Web:

```bash
npm --prefix apps/web test
npm --prefix apps/web run check
npm --prefix apps/web run verify:build
npm --prefix apps/web run test:global-geographic-framing
npm --prefix apps/web run test:e2e
npm --prefix apps/web run test:visual
npm --prefix apps/web run test:deployment
npm --prefix apps/web run test:hosted
```

Run only the focused subset during a subtask, then the task/phase gate required
by the active goal.

## Default test constraints

Default tests must:

- make no live Flickr, GBIF, iNaturalist, OpenAI, Supabase, or B2 call;
- require no model weights, GPU, or source-image collection;
- use deterministic fixtures, clocks, seeds, and storage;
- validate checksums, schemas, rights, provenance, and source pins;
- fail closed on missing/stale/incompatible evidence;
- preserve unavailable states.

## Required test areas

### Contracts/facade

- JSON Schema/runtime parity;
- explicit availability;
- fixture-specific validation separated from product logic;
- orphan and inconsistent IDs;
- source/fingerprint propagation.

### Verification

- checksum-gated media;
- disabled scientific controls before display;
- append-only events and supersession;
- independent reviewer consensus;
- conflicts/adjudication;
- blind context;
- audit versus failure-discovery;
- weighted/insufficient quality states;
- BioMiner-compatible exports;
- no review/release side effects in public replay.

### Geographic Impact

- canonical public, judge, stored-replay, and hosted framing remains Global;
- optional drilldown tests select scopes from checksum-verified artifacts rather
  than embedding a named country, ISO code, cell, or candidate record;
- provider union and no double counting;
- precision-aware cells;
- full-outer joins and rollup reconciliation;
- candidate/human/release tiers;
- zero-denominator unavailable;
- same-resolution proximity;
- temporal missing states;
- data-deficiency reasons;
- bubble scale;
- slicer/breadcrumb/deep-link state;
- map/table synchronization;
- no external network;
- no-WebGL fallback;
- deterministic exports and manifest.

### Web/accessibility

- Chromium full journey;
- Firefox and WebKit smoke;
- keyboard and focus;
- screen-reader summaries;
- reduced motion;
- high contrast;
- 1280×720;
- mobile review;
- visual regression.

### Agent

- tool contracts;
- stored replay;
- citations;
- unsupported-claim rejection;
- no live call in default suite.

## Failure policy

- Preserve the first exact failure.
- Do not weaken scientific, rights, provenance, accessibility, or network guards
  to pass a test.
- Do not restore obsolete code for stale tests.
- Update contract and tests together when intended behavior changes.
- A flaky test requires root-cause repair and repeated evidence, not a skip.
- Human/live work remains unavailable when not executed.

## Current observed evidence

Latest committed Geographic Impact Task 5.3 report:

```text
frontend               477 passed, 1 skipped
focused export         8 passed
TypeScript             passed
production build       passed
Chromium map/network   4 passed
provenance             passed
```

Prior verification completion reported a complete implementation but **zero
retained human outcomes**. Do not convert contract coverage into scientific
quality.

Always record current local counts instead of copying these historical values.

## Task completion

Before push:

1. focused tests;
2. TypeScript/Python checks;
3. relevant build/network/rights checks;
4. provenance verifier;
5. `git diff --check`;
6. staged-file inspection;
7. task report with exact commands/results;
8. push and remote SHA verification.

## Hosted replay

Verify in incognito:

- public HTTPS;
- no login/credentials;
- exact build fingerprint;
- reset;
- map and no-WebGL fallback;
- Verification workflow;
- Agent Trace replay;
- exports;
- no unexpected external origins;
- source commit matches deployed fingerprint.

Do not deploy over an active submitted snapshot without the goal's explicit
deployment step.

## Competition release

Release must include:

- working public product;
- credential-free replay;
- README/Judge Guide;
- video under three minutes;
- exact Codex `/feedback` Session ID;
- Codex/GPT-5.6 explanation;
- Build Week delta;
- repository/source and rights evidence;
- every public number artifact-backed.

Scientific release remains separate from competition release.

Do not claim:

- human productivity from scripted browser actions;
- accuracy without independent reviewed labels;
- human-supported map cells with zero decisive outcomes;
- public rights to restricted reference images;
- live functionality from a static mirror;
- implemented future agent/map tasks.
