# Phase 3 report — deterministic judge web application

## Outcome

Phase 3 delivers a static, credential-free React judge application that loads the truthful *Papilio demoleus* bundle and preserves its evidence boundaries in the browser. The app provides four hash-addressable views, persistent replay lineage, an accessible guided tour, explicit unavailable evidence, and a fail-closed scientific display.

React never fetches a scientific artifact directly. The evidence facade validates the authoritative judge-bundle contract, verifies the pinned TaxaLens and BioMiner revisions, recomputes both bundle roots, and checks all 17 artifact byte counts and SHA-256 digests before returning any replay value to the shell.

No live backend, credential, model request, CDN asset, or unlicensed media is required. DuckDB-Wasm remains lazy and is not started for the JSON-only pilot bundle.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Starting SHA after Phase 2 reporting: `886ed6fddff313b8cdd1cb268b6f685de950af59`
- Task 3.1: `279c4c7e2cc08e10683ce5272ac49f4f02ae9816` — scaffold the judge web application
- Task 3.2: `33c9ff2b16d784bdfa32e3ab389f58ca66d570a8` — add the scientific-editorial design system
- Task 3.3: `5d1677039dc038b0f9de17b9e2c3fb4faed6aa49` — build the shared application shell
- Task 3.4 and pushed Phase 3 SHA: `767be3fdc8640b2012c15aaea83a434da71ac491` — connect the replay evidence facade

At the Phase 3 gate, local `HEAD` and `origin/main` both resolved to `767be3fdc8640b2012c15aaea83a434da71ac491`.

## Static application and deployment boundary

`apps/web` is a strict TypeScript React 19 application built with Vite. Its production output uses relative URLs and is deployable as static files under a subpath. Vite copies the committed pilot fixture byte-for-byte into the build; the build verifier compares the output inventory with the source fixture and recomputes every byte count and SHA-256 digest.

The initial shell does not instantiate DuckDB, start a worker, contact a remote API, or request a model. The pinned DuckDB-Wasm module remains behind a lazy browser import for later evidence views. The replay uses same-origin requests with `no-store` caching and exposes one global failure state if any required local asset cannot be verified.

## Scientific-editorial interface

The design system separates literal palette values, semantic aliases, and component rules. It defines evidence states for available, loading, review, abstention, blocked, failure, and unavailable data, and communicates distinctions with text, icons, border treatment, and patterns rather than color alone.

Typed evidence primitives keep these scientific distinctions explicit:

- candidate versus occurrence;
- raw score versus calibrated probability;
- metadata, unreviewed, reviewed, and unavailable evidence tiers;
- point estimates versus uncertainty;
- scientific claims versus review-required hypotheses.

Scientific figures require a title, prose description, tier, and caption. A keyboard-operable image-comparison foundation exists for future licensed pairs but is deliberately not rendered for this zero-media fixture.

## Shared judge journey

The application shell provides Mission, Observatory, Evidence Lens, and Dashboard navigation with `aria-current` state and URL hashes. Target identity, bundle ID, TaxaLens SHA, BioMiner SHA, and replay mode remain visible across all four views.

Reset returns to Mission and reloads the same local bundle without deleting data or changing scientific state. The four-step guided tour uses a labelled dismissible React Aria dialog with managed focus and restoration. A visible skip link, semantic landmarks, keyboard navigation, reduced-motion behavior, and narrow-screen layouts are covered in tests.

## Browser evidence facade

The facade is the only production scientific-data boundary. It:

1. parses the manifest as fatal UTF-8 JSON;
2. validates the draft 2020-12 schema with a compile-once, fail-fast Ajv validator;
3. requires the exact pilot bundle ID and pinned source revisions;
4. validates unique artifact IDs and paths, section references, record counts, rights coverage, attribution coverage, and expected UI counts;
5. recomputes the canonical inventory and payload-root SHA-256 values;
6. fetches all artifacts in stable path order;
7. verifies every byte count and Web Crypto SHA-256 digest before JSON decoding;
8. blocks the display unless the metadata-only hero still awaits human review and forbids a scientific claim.

All 20 section states are projected through the facade. The six unavailable sections retain their committed names and reasons in the Evidence Lens rather than becoming empty cards or inferred zero values.

Section loading can accept a verified Parquet artifact through an injected Wasm reader. If Parquet is absent, the Wasm reader is absent, or the reader fails, it returns an already checksum-verified JSON artifact with an explicit fallback reason. Tests exercise all three branches without starting DuckDB for the real JSON-only fixture.

## Truthful display state

The browser preserves the Phase 2 scientific state:

- bundle ID `papilio-demoleus-pilot-75461d9c-v1`;
- 17 of 17 artifacts checksum verified;
- inventory and payload roots verified;
- six explicitly unavailable sections;
- rights state `license_checked`;
- hero `papilio-demoleus-pilot-awaiting-review`;
- scientific claim not allowed;
- no image, classification, occurrence, detection, transformation, calibrated probability, or Phase 13 result displayed.

The target name identifies the research mission. It is not presented as an image label or occurrence.

## Phase gates

The final Phase 3 gate passed:

- `uv sync --locked`;
- `uv run --locked pytest -q` — 622 passed;
- `npm ci` and `npm audit --audit-level=low` — zero vulnerabilities;
- strict TypeScript project check;
- Vitest — 16 passed across six files;
- production Vite build and static fixture verifier;
- Chromium Playwright — four flows covering same-origin replay, narrow viewport, reduced motion, keyboard tour/navigation/reset, checksum status, unavailable evidence, and JSON fallback;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`, including rights and attribution checks;
- BioMiner boundary verification against the pinned SHA with its snapshot written outside the repository;
- `uv lock --check`;
- GitHits JSONL parsing and `git diff --check`;
- visual inspection at 1280×720 and 390×844.

Phase 3 modified no Python source. The applicable web lint-equivalent gate is strict TypeScript. A repository-wide Ruff check still reports 207 inherited formatting and import-order findings in preserved replay Python and tests; this existing debt was not mechanically rewritten during the browser phase.

## BioMiner boundary decision

TaxaLens rechecked the pinned BioMiner repository at `75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Its committed fixture artifacts satisfy the new browser contract and checksum verification. No missing BioMiner producer or engine implementation was proven, so BioMiner source was not modified.

Existing untracked BioMiner configuration, documentation, query-term, and log paths remained untouched and were not treated as evidence.

## Accepted limitations and Phase 4 handoff

- The app is a local/static replay and is not yet published to a hosted URL.
- Mission currently displays the bounded pilot target; it does not yet expose the research-policy form, budgets, or stopping conditions required by Phase 4.
- Observatory, Evidence Lens, and Dashboard are truthful foundations, not their later full workflows.
- No licensed hero image or human-verified target classification is available.
- No real pilot Parquet payload is committed to this judge bundle, so production Wasm execution remains deferred while its fallback contract is tested.
- The project does not yet have the later submission verifier or hosted incognito-mode gate.

Phase 4 must build the research mission interface from artifact-backed policies and prerequisites. It must preserve the facade as the sole scientific-data boundary and keep replay/live mode, budgets, and missing requirements explicit.
