# Phase 8 report — Configured model research analyst

Phase 8 was completed on **2026-07-15** from the Phase 7 report at
`ce73e71e8f466df6ae202e013ae0f78dff0aeb0b` through the final numbered task at
`018599d72182b2a04dccb4c63bd3a75681e53100`.

## Outcome

TaxaLens now has an evidence-bound research-analyst foundation centred visibly and technically on
the exact `configured-model` model. The implementation defines a server-only Responses API loop, nine
strict read-only tools, a strict structured final-output contract, an auditable public trace, one
checksum-bound stored analyst run, and a deterministic initial workflow evaluation.

The default judge path remains credential-free. It does not call OpenAI, launch BioMiner, fetch new
evidence, run scientific inference, or promote candidate metadata into an occurrence or
classification. The Agent view labels the committed session as **Stored output · no live call** and
re-executes its recorded tool exchange locally before displaying it.

## Immutable task record

| Task | Commit | Delivered boundary |
| --- | --- | --- |
| 8.1 | `52fb3c1592874544b799f2104895b36b4ce17d4c` | Official Configured model, Responses, Structured Outputs, function-tool, Programmatic Tool Calling, security, and replay contract |
| 8.2 | `a75dc6656fa2b663527cfcfaf1063e8aa578d18b` | Nine deterministic evidence tools over the checksum-verified replay |
| 8.3 | `a857a9e28ba90d0d9368cc525c477626e19756b6` | Bounded `configured-model` Responses analyst and server-only transport adapter |
| 8.4 | `77cd51e7a61945ffef9f0603b9ecd960460abaa9` | Public audit projection and fifth lazy Agent workspace |
| 8.5 | `552e75c7e612c48681e79d2d5609578b575477ee` | Credential-free stored request and run with local deterministic replay validation |
| 8.6 | `018599d72182b2a04dccb4c63bd3a75681e53100` | Initial 19-case research-workflow evaluation with an explicit pass threshold |

Every numbered task was independently committed and pushed before the next task. Each task has a
GitHits record and a BioMiner boundary snapshot. The commits preserve the required origin,
human-decision, test, and AI-assistance disclosures.

## Verified OpenAI implementation contract

The implementation decision was frozen only after checking current official OpenAI documentation
on 2026-07-15:

- exact model ID `configured-model` rather than a moving alias;
- Responses API at `POST /v1/responses`;
- explicit standard reasoning mode with `medium` or `high` effort;
- strict Structured Outputs under `text.format`;
- direct strict function calling for the ordinary analyst loop;
- `store: false`, while making no Zero Data Retention claim;
- Programmatic Tool Calling available only for a future justified bounded multi-read reduction;
- API keys and the OpenAI transport confined to a server environment;
- no hidden reasoning or chain-of-thought in the public trace.

The full source and compatibility assessment is recorded in
`docs/reports/openai-model-implementation-contract.md`. The GitHits-generated alternative was
rejected because its model, tool-calling, persistence, replay, and runtime assumptions did not meet
the verified contract.

## Nine evidence tools

The research layer exposes these stable tools:

| Tool | Evidence-bound purpose |
| --- | --- |
| `resolve_taxon` | Match the exact replay scientific name or accepted taxon key |
| `inspect_query_coverage` | Inspect committed query, request, candidate-hit, canonical-photo, and geographic workload facts |
| `estimate_mission` | Draft a replay-only mission while retaining every eligible regional candidate |
| `inspect_stage` | Report a named pipeline stage and its explicit available, pending, blocked, or unavailable state |
| `trace_lineage` | Return the committed evidence lifecycle for a known review record |
| `compare_candidates` | Compare target and regional hypotheses without inventing a score, rank, or strongest competitor |
| `explain_decision` | Explain the pending selective-decision boundary without relabelling it as model abstention |
| `inspect_reference_status` | Report source-media readiness, human-review gaps, and shortfalls |
| `export_evidence` | Prepare local deterministic output receipts without starting a download or write |

All definitions use strict closed input and output schemas. Arguments and results are validated at
runtime, results are immutable and deterministic, and every result cites at least one artifact from
the verified inventory. `export_evidence` is direct-only; the other tools declare direct and
programmatic eligibility but the current analyst loop permits direct callers only.

Tool execution performs no network, credential, clock, random, filesystem, process, acquisition,
inference, or external-write action. Unsupported identities and records return typed unavailable
states. Stage availability never authorizes a scientific claim. Candidate hits remain workload, a
missing geography remains unknown, source-media candidates remain unverified support, and absent
visual scores leave abstention and strongest-competitor claims unevaluated.

## Bounded analyst loop

The server-transport-injected analyst uses exact `configured-model`, explicit standard reasoning,
`store: false`, disabled parallel tool calls, strict final JSON, and explicit response-turn and tool
budgets. Default limits are eight tool calls and six response turns; accepted requests may not
exceed twelve calls or ten turns.

The analyst must resolve the replay target first. It preserves the typed Responses output items
needed to continue a tool turn, correlates every result to its original `call_id`, and accepts only
one direct function call per response. Final claims, plan steps, unavailable-evidence entries, and
approval items may cite only verified artifacts returned by tools in that run.

The structured output separates:

- a public action plan;
- evidence-backed claims;
- unavailable evidence;
- limitations;
- artifact citations;
- approval boundaries;
- a human-readable answer.

Mission planning never launches work. Acquisition, inference, downloads, publication, and
scientific promotion remain outside the analyst run and must appear as blocked approval items if
requested. The official OpenAI JavaScript SDK is installed for a small server-only transport
adapter; that adapter rejects browser construction and is not exported into the static application.

## Public trace and stored replay

The fifth lazy workspace makes the Configured model contract visible in the product and displays only
reviewable public fields: request, public plan, validated tool parameters, complete deterministic
tool results, verified artifacts, strict structured output, answer, model, effort, statuses, and
measured tool/turn budgets.

Raw Responses items, private reasoning, and chain-of-thought are structurally absent from the
public trace. Token usage is not shown because the committed run does not retain it. The interface
does not infer hidden reasoning from budgets or expose a browser credential.

The truthful fixture now contains 24 checksum-verified artifacts. Two are dedicated public replay
artifacts:

- `agent/stored_analyst_request.json`;
- `agent/stored_analyst_run.json`.

The stored run names `configured-model`, uses medium standard reasoning, records a completed two-turn,
one-tool target-resolution exchange, and cites `query-definitions`. It states that target identity
is neither an occurrence, an image classification, nor a scientific result. It uses explicit
stored-replay response IDs and claims no occurrence time.

Before display, TaxaLens validates both JSON schemas, the target identity, budgets, tool receipts,
tool results, citations, response identifiers, and final structured output. It then re-executes
every recorded tool locally and requires exact canonical equality with the stored result. A
mismatch rejects the trace; it never falls back to a live request.

## Initial agent evaluation

The Phase 8 evaluator contains 19 deterministic cases and 151 named checks. The aggregate passing
threshold is `0.95`; every individual case must score `1.0`. The committed run scores `1.0`, with
all 19 cases passing.

Coverage includes:

- stored replay integrity and credential-free loading;
- mission planning and the all-candidates policy;
- why a workload or lineage record was found;
- why detector, transformation, score, or decision evidence is unavailable;
- pending review versus model abstention;
- unavailable strongest-competitor ranking;
- reference-source and human-verification shortfalls;
- source candidate versus biological occurrence;
- unavailable embedding-reuse accounting;
- no-geo fallback as unknown rather than absence;
- rejection of unsupported taxon and record claims;
- stage availability versus a scientific result;
- receipt preparation without download;
- exact target resolution and verified citations.

Each tool case checks the selected tool and status, expected facts, required artifacts, record
cardinality, inventory-resolved citations, the scientific non-promotion flag, required boundary
language, and forbidden unsupported language. The evaluation makes no network, model, clock, or
random call and returns the same immutable report on repeat execution.

This is an initial deterministic research-workflow evaluation. It does **not** measure live Configured model
answer quality, and it is not BioMiner Phase 14 scientific evaluation. No precision, accuracy,
calibration, biological performance, or classification metric is inferred from it.

## Product and performance boundary

The production build remains a static replay application. The final Phase 8 build contains a
464.14 kB main JavaScript chunk and a separate 43.05 kB Agent workspace chunk, with no Vite size
warning. DuckDB-Wasm, its worker, and Parquet extension remain separate lazy assets. The static
bundle contains no OpenAI endpoint, API-key path, authorization header, or server adapter import.

The Agent workspace is keyboard-operable, supports the existing reduced-motion and narrow-viewport
contracts, uses native disclosure and progress controls, links citations to internal artifact
receipts, and presents loading, rejected, unavailable, live, and stored-replay states distinctly.
Desktop and 390×844 inspection confirmed the stored-run label, public trace hierarchy, complete
tool result, artifact receipt, structured-output disclosure, answer, and budget presentation.

## Phase gates

The final Phase 8 gate passed:

- `uv run --locked pytest` — 628 passed;
- `npm run test:agent` — 3 tests covering 19 cases and 151 checks;
- Vitest — 106 passed across 47 files;
- strict TypeScript project check;
- `npm audit --audit-level=high` — zero vulnerabilities;
- production Vite build and byte-exact 24-artifact static verification;
- Chromium Playwright — 20 flows;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification at the pinned SHA with per-task state snapshots;
- GitHits JSONL validation and `git diff --check`;
- desktop and 390×844 visual inspection for the new Agent workspace.

The repository-wide Ruff audit continues to have the previously recorded 209 findings in
mechanically preserved BioMiner modules and tests. Phase 8 did not sweep those provenance-sensitive
files.

## BioMiner boundary decision

BioMiner remained on `main` at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Phase 8 inspected its committed contracts and reused
only the already imported checksum-verified evidence, registry vocabulary, pipeline stage IDs,
geographic workload metadata, candidate sets, reference shortfalls, and decision boundaries.

No BioMiner runtime, evaluator, synthetic scientific fixture, or live operational code was copied.
BioMiner itself was not modified. Its pre-existing untracked configuration, documentation,
query-term, and log paths remained untouched and outside the TaxaLens evidence boundary.

## Accepted limitations and Phase 9 handoff

- The public session is one stored output, not a newly generated live response.
- No production server route, secret-store integration, approval workflow, or explicitly opted-in
  live-model test exists yet.
- The initial evaluation verifies deterministic workflow and policy behaviour, not language-model
  quality or scientific performance.
- No rights-cleared image, detector result, transformed frame, embedding, reuse ledger, visual
  score, calibrated probability, reviewed label, ranked competitor, or final scientific evidence
  record is committed.
- Search candidates, geographic workload, and source-media candidates remain non-scientific
  operational metadata.
- The stored replay and existing export manifests are checksum-bearing but unsigned.

Phase 9 can build on the stable public trace and evidence tools without weakening the credential-free
default. Any live route must preserve the exact model, strict schema, budget, approval, citation,
privacy, and server-only credential boundaries established here, and it must remain separate from
BioMiner scientific evaluation.
