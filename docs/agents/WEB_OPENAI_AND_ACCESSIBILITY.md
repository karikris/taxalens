# Web product, accessibility, and GPT-5.6

## Web stack

Current web baseline:

```text
React 19
TypeScript 7 strict
Vite 8
React Aria Components
DuckDB-Wasm
Apache Arrow
MapLibre/react-maplibre
Vitest
Playwright
```

Use runtime validation at every artifact boundary. Do not traverse untyped JSON
in product code.

## Product navigation

Primary surfaces:

```text
Mission
Observatory
Evidence Lens
Verification
Geographic Impact
Dashboard
Agent Trace
```

Keep one primary user action per screen and use progressive disclosure for
engineering detail.

## Design semantics

- Scientific names italicized.
- Candidates and occurrences use distinct language and markers.
- Raw and calibrated evidence use distinct components.
- Gold/silver/bronze colors, if present, cannot silently redefine scientific
  maturity.
- Red indicates explicit contradiction or failure, not ordinary uncertainty.
- Empty, unavailable, blocked, review, conflict, and abstention states are
  deliberately designed.
- Do not fill an empty state with synthetic attractive data.

Avoid:

- generic admin template;
- decorative 3D butterflies;
- neon AI gradient;
- walls of KPI cards;
- fake confidence gauges;
- map symbols implying candidates are occurrences.

## Accessibility

Required:

- semantic HTML;
- keyboard navigation and visible focus;
- screen-reader status and selection summaries;
- reduced-motion support;
- high-contrast support;
- no information encoded only by color;
- accessible chart/table descriptions;
- 1280×720 judge layout;
- mobile-safe review controls;
- synchronized map and table.

Map requirements:

- slicers, breadcrumbs, map, details, and table share controlled state;
- map selection identifies the table row;
- table selection updates map/details;
- exact values appear in text;
- no-WebGL fallback remains fully usable.

Review requirements:

- scientific decision controls disabled until required media validation/display;
- state changes announced;
- blind context remains hidden before the event;
- errors are actionable and do not discard entered comments silently.

## GPT-5.6 role

GPT-5.6 is the research analyst, not the species classifier.

Current public contract uses:

- `gpt-5.6-sol`;
- Responses API;
- strict Structured Outputs;
- read-only evidence tools;
- explicit tool budgets;
- artifact citations;
- stored credential-free replay;
- visible plans/tool parameters/results, not hidden reasoning.

Approved tasks:

- plan research;
- inspect run/stage state;
- trace record lineage;
- compare candidates where evidence exists;
- explain unavailable decisions;
- inspect verification/quality;
- analyze deterministic geographic impact;
- recommend the next review action;
- prepare exports/reports.

Prohibited:

- identify species from model memory;
- invent taxon IDs, records, reviews, counts, margins, or probabilities;
- treat a candidate as an occurrence;
- override release gates;
- expose private chain-of-thought;
- make write actions without approval.

## Tool design

Each tool returns:

- structured values;
- artifact and snapshot IDs;
- source SHAs;
- availability and error states;
- citations;
- no hidden side effect.

Deterministic code calculates:

- joins;
- counts;
- distances;
- rankings;
- review projections;
- statistical intervals;
- release gates.

GPT-5.6 interprets those results.

## Current and planned analyst state

Current product has a bounded verification analyst and stored replay. The
Geographic Impact goal plans additional read-only tools such as:

```text
inspect_geographic_impact
compare_geographic_scopes
list_candidate_gap_cells
explain_coverage_contribution
recommend_geographic_review_batch
inspect_baseline_provider_union
```

Do not claim these are implemented until current code/tests show them.

## Secrets

- OpenAI key stays server-side.
- Static judge build contains no key.
- Default CI makes no live model call.
- Live evaluations are explicit, bounded, and recorded.
- Stored replay is labelled replayed and checksum-bound.

## Agent evaluation

Evaluate:

- correct tool selection;
- artifact citation;
- unsupported-claim rejection;
- unavailable-state disclosure;
- provider double-count prevention;
- candidate/reviewed/release distinction;
- representative versus targeted sampling;
- no species-memory guessing;
- budget compliance;
- schema validity.

Agent test count is not scientific accuracy.
