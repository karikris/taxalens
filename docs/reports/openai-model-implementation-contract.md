# OpenAI Configured model implementation contract

Verified against current official OpenAI documentation on **2026-07-15** before any TaxaLens agent
implementation.

Reverified through the official OpenAI Developer Docs service on **2026-07-16** during the final
completion audit. The exact model, Responses API, Structured Outputs, direct-tool, and bounded
Programmatic Tool Calling contracts below remain current without implementation changes.

## Decision

TaxaLens will implement its live research analyst with:

| Concern | Frozen implementation choice |
| --- | --- |
| Model | Exact model ID `configured-model` |
| API | Responses API, `POST /v1/responses` |
| Reasoning | Standard mode with explicit `reasoning.effort: "medium"` or `"high"` |
| Final output | Strict Structured Outputs through `text.format` |
| Evidence access | Strict, read-only function tools returning artifact IDs |
| Ordinary orchestration | Direct function calling |
| Bounded high-fan-out reads | Programmatic Tool Calling only when the task shape justifies it |
| API persistence | `store: false`; TaxaLens owns its explicit, reviewable trace contract |
| Credential-free path | Committed replay trace, clearly labelled as replay rather than a live call |
| Browser security | No OpenAI API key or direct OpenAI request in browser code |

The `configured-model` alias currently routes to `configured-model`, but TaxaLens will use the exact required model
ID so model provenance is explicit. The model may plan and explain the evidence workflow. It may not
guess a species, manufacture evidence, replace BioMiner decisions, or turn candidate metadata into a
scientific result.

## Official source verification

| Surface | Verified official result | Source |
| --- | --- | --- |
| Latest model guidance | `configured-model` is the flagship capability model; the `configured-model` alias routes to it. Configured model supports `none`, `low`, `medium`, `high`, `xhigh`, and `max` reasoning effort. | [Using Configured model](https://developers.openai.com/api/docs/guides/latest-model) |
| Model contract | The exact model ID is `configured-model`; it is a reasoning model supporting Responses, Structured Outputs, function calling, streaming, text/image input, and text output. | [Configured model Sol model](https://developers.openai.com/api/docs/models/configured-model) |
| Responses API | Responses is recommended for new projects and uses typed output items for messages, reasoning, function calls, and function-call outputs. | [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) |
| Structured Outputs | Responses uses `text.format`; strict JSON Schema output is distinct from JSON mode, and refusals must be handled separately. | [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs) |
| Tool calling | Function tools use JSON Schema definitions; returned `function_call` items carry `name`, JSON-encoded `arguments`, and `call_id`, and applications return `function_call_output` items. | [Function calling](https://developers.openai.com/api/docs/guides/function-calling) |
| Programmatic Tool Calling | A hosted isolated V8 program can coordinate eligible tools; applications configure `allowed_callers` and handle `program`, nested `function_call`, and `program_output` items. | [Programmatic Tool Calling](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling) |
| REST shape | The current OpenAPI 3.1 document exposes `POST /v1/responses` as operation `createResponse` with a required JSON request body and a typed Response or event-stream result. | [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create) |

The OpenAPI document reported specification version `2.3.0` and MIT licence metadata when queried
through the official OpenAI Developer Docs service. Example model IDs embedded in generic OpenAPI
examples are not the TaxaLens model-selection authority; the latest-model and exact model pages above
are.

## Responses API contract

Responses is the correct foundation for TaxaLens because the analyst is a multi-turn, tool-using
workflow rather than a single text completion. The implementation must:

- create requests through the official OpenAI SDK's Responses surface;
- send the exact model ID and explicit reasoning effort on every live request;
- treat `response.output` as typed items rather than assuming one message string;
- preserve all output items required to continue a reasoning/tool turn;
- handle zero, one, or multiple function calls in a response;
- stop only after a completed final message or a handled refusal/error state;
- impose explicit model-turn, tool-call, and per-tool budgets;
- use `store: false` and persist only the TaxaLens trace fields approved for audit and replay.

Official documentation says Responses are stored by default and `store: false` disables that API
statefulness. `store: false` is not itself a Zero Data Retention entitlement. TaxaLens therefore
makes no ZDR claim.

## Structured Outputs contract

The final mission plan and evidence explanation will each have a versioned JSON Schema. In a
Responses request the shape belongs under:

```json
{
  "text": {
    "format": {
      "type": "json_schema",
      "name": "taxalens_output_name",
      "strict": true,
      "schema": {}
    }
  }
}
```

TaxaLens will keep the schema and TypeScript contract generated from one source or validate their
equality in tests. Every object schema will reject undeclared properties, and every supported field
will have explicit required/nullable semantics.

Schema conformance is not evidence correctness. The application must still verify every referenced
artifact ID, reject unsupported claims, and present safety refusals and incomplete responses as
separate states rather than parse failures or successful analyses.

## Direct function-tool contract

Task 8.2 will expose nine deterministic, read-only research tools:

1. resolve taxon;
2. inspect query coverage;
3. estimate mission;
4. inspect stage;
5. trace lineage;
6. compare candidates;
7. explain decision;
8. inspect reference status;
9. export evidence.

Each tool definition and implementation must:

- use a stable snake-case name and a narrow description;
- set `strict: true`;
- use an object parameter schema with `additionalProperties: false`;
- mark every property required, using an explicit nullable union where necessary;
- validate arguments again inside TaxaLens rather than trusting generated JSON;
- return deterministic JSON with at least one verified artifact ID;
- return structured unavailable states rather than inventing an answer;
- perform no network request, scientific model run, credential read, clock read, or random action;
- remain idempotent and free of external side effects.

The live loop must preserve the response output items that preceded a call and correlate each result
with the original `call_id`. Reasoning items required for continuation stay in the API transcript but
are not exposed as private reasoning in the product trace.

## Programmatic Tool Calling contract

Programmatic Tool Calling is verified for Configured model, but it is not the default route. Use it only for a
bounded stage where JavaScript can filter, join, deduplicate, aggregate, or validate several
deterministic tool results and emit a materially smaller structured result.

Do not use it when:

- one or two direct calls are sufficient;
- a result should change the model's next semantic decision;
- an action requires approval;
- native artifacts or citations must be preserved without reduction;
- the program cannot know a tool's output shape in advance.

When enabled, the request must include the `programmatic_tool_calling` hosted tool. Eligible
read-only tools must declare an `output_schema` and an explicit
`allowed_callers: ["direct", "programmatic"]`. `export_evidence` remains direct-only so the native
artifact boundary is not reduced inside a program.

The application loop must understand and preserve:

- the `program` item's `call_id` and opaque fingerprint;
- every program-issued `function_call` and its `caller` relationship;
- returned `function_call_output` items with the original `call_id` and unchanged `caller`;
- the `program_output` result and completed/incomplete status;
- any later final assistant message.

The hosted program runs in fresh isolated V8. It has no Node.js, package installation, direct
network, general filesystem, subprocess, console, or persistent JavaScript state. TaxaLens executes
its own client-owned tools and validates every call; it does not execute the generated program.

## Approval and scientific boundaries

The research analyst receives an explicit policy:

- read-only evidence inspection is allowed within the request's tool budget;
- mission planning produces a draft and never launches BioMiner work;
- external writes, live acquisition, downloads, model runs, and scientific promotion require a
  separate human-approved workflow;
- search candidates are hypotheses, not occurrences;
- source-media candidates are not verified support;
- raw similarities are not probabilities;
- no probability-like output is allowed without a committed calibrator;
- missing evidence is unknown or unavailable, never proof of absence;
- the target remains scoreable and all eligible regional candidates remain in scope;
- unsupported precision, accuracy, savings, or successful-classification claims must be rejected.

The final Structured Output must separate evidence-backed claims, unavailable evidence, limitations,
artifact citations, required approvals, and a human-readable answer. The service must reject an
output if an artifact citation cannot be resolved through the verified facade.

## Trace and replay boundary

Task 8.4 may display only auditable, non-private fields:

- redacted request metadata and user request;
- public analyst plan or structured plan output;
- tool names, validated parameters, statuses, and budgets;
- tool results or bounded summaries with artifact IDs;
- structured final output and rendered answer;
- model ID, reasoning effort, response status, and token/tool usage where supplied.

It must not display hidden chain-of-thought or claim that API reasoning items are a public plan.

Task 8.5 will load a committed trace when no API key is available. Replay must be labelled, must not
call OpenAI, and must validate the same schemas, tool names, artifact IDs, budgets, and final output
as a live trace. A replayed answer is a recorded model output, not a newly generated live answer.

## Credential and test boundary

The OpenAI key belongs only in a server-side environment. The static browser replay must remain
fully usable without it. No default unit, integration, build, Playwright, or evaluation command may
make a live OpenAI call.

Live tests, if added later, must require an explicit opt-in environment flag in addition to the key,
use bounded budgets, and remain outside the default gate. Recorded trace fixtures must contain no
credential, authorization header, private reasoning, unreviewed personal data, or unsupported
scientific claim.

## GitHits assessment

GitHits solution `3750a0fe-3ef8-4d89-a41a-52963a0e4476` was inspected only after official-source
verification and received negative feedback. Its generated example used `gpt-4.1-mini`, did not
actually configure Programmatic Tool Calling, used a shallow key sorter as canonical JSON, mutated
replay arrays, coupled the flow to Bun, assumed a temperature setting, and cited an unrelated
webfont pull request. No code or API claim was adopted from it.

TaxaLens will implement the contract above from official OpenAI documentation and its existing
deterministic evidence facade.
