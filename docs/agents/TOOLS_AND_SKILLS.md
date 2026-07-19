# Tools, GitHits, Valyu, MCP, and skills

## Discovery order

Use the smallest trustworthy source:

1. Local code, tests, schemas, manifests, task reports, and Git history.
2. Accepted TaxaLens ADRs and human decisions.
3. Official primary documentation or literature.
4. GitHits implementation precedents.
5. Secondary summaries only when primary material is unavailable.

Do not load the whole repository when a symbol, test, contract, or report
answers the question.

## GitHits

The current Geographic Impact goal requires GitHits for every task and subtask.

Use it for:

- React, TypeScript, MapLibre, DuckDB-Wasm, Arrow, and accessibility patterns;
- canonical JSON/CSV/Parquet export patterns;
- append-only review and consensus systems;
- Supabase RLS and offline synchronization;
- static/offline web applications;
- test, deployment, network guard, and performance patterns;
- OSS dependency internals.

### Workflow

1. Inspect TaxaLens code/tests first.
2. Form a narrow implementation question.
3. Review at least two approaches when practical.
4. Record query, repositories, adopted/rejected patterns, licence notes, and
   rationale.
5. Implement a TaxaLens-native solution.
6. Append the record to:

```text
provenance/githits.jsonl
```

If unavailable:

- record one failed attempt;
- do not retry repeatedly;
- use local evidence and official docs;
- mark the record `unavailable`;
- never invent results or solution IDs.

GitHits is precedent, not authority. Do not copy code wholesale.

## Valyu

Use Valyu when a task depends on current or authoritative external facts:

- OpenAI models, Responses API, Structured Outputs, tool calling;
- Flickr, GBIF, iNaturalist, ALA, Supabase, B2, MapLibre, DuckDB, H3;
- provider terms, licences, public display requirements;
- scientific papers and standards;
- accessibility or security specifications.

Rules:

- prefer official docs and primary literature;
- record retrieval date, version, and source;
- separate source fact from inference;
- update an ADR when an external finding changes architecture or release;
- do not let external results directly define taxon identity, review outcome,
  model decision, quality estimate, or release state.

Valyu and GitHits are developer tools, never production data sources.

## OpenAI work

For OpenAI tasks:

1. Verify current behavior from official OpenAI documentation.
2. Use GitHits only for implementation examples.
3. Record exact model ID, API, reasoning mode, tool schema, and evaluation.
4. Keep secrets server-side.
5. Preserve the credential-free stored replay.

## Morph

Morph is optional for semantic code navigation or targeted edits when installed
and permitted by the current goal.

- Do not use it for broad rewrites.
- If unavailable, record the failure once and use local search.
- Do not repeatedly call it.
- Never make Morph a runtime dependency or scientific source.

## Skills

Before using an installed skill:

1. Read its `SKILL.md`.
2. Confirm it fits the task.
3. Confirm it does not conflict with direct-main, provenance, scientific, or
   rights rules.
4. Record the skill used.

Typical routing:

| Task | Skill |
|---|---|
| Repository/PR/issue triage | GitHub skill |
| Review feedback | `gh-address-comments` |
| GitHub Actions failure | `gh-fix-ci` |
| Commit/push/publish | publishing skill only if compatible with direct-main |
| Documents/slides/spreadsheets/PDFs | matching artifact skill |
| Large logs | Headroom when available |

## Headroom and token discipline

Use Headroom for long repetitive logs or reports when available. Preserve the
compression identity and retrieve exact source before editing.

Otherwise use:

```text
rg
focused GitHub/file reads
git diff --stat
git diff -- path
pytest/vitest focused files
jq selected fields
DuckDB/Polars summaries
```

Do not paste raw Parquet, model vectors, full logs, or repeated progress.
