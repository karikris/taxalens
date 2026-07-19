# TaxaLens agent instruction index

The root [`AGENTS.md`](../../AGENTS.md) contains only always-needed rules. Load
topic documents only when relevant.

| Document | Use |
|---|---|
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | New session/goal, active-goal status, current architecture, stale-doc warnings |
| [`GIT_AND_PROVENANCE.md`](GIT_AND_PROVENANCE.md) | Before Git changes, commit, push, deployment, provenance |
| [`TOOLS_AND_SKILLS.md`](TOOLS_AND_SKILLS.md) | GitHits, Valyu, MCP, skills, dependency research |
| [`SCIENCE_AND_PRODUCT.md`](SCIENCE_AND_PRODUCT.md) | Scientific evidence, BioMiner boundary, product semantics |
| [`GEOGRAPHIC_IMPACT_AND_VERIFICATION.md`](GEOGRAPHIC_IMPACT_AND_VERIFICATION.md) | Map, provider union, review, quality, active goal |
| [`DATA_REPLAY_AND_STORAGE.md`](DATA_REPLAY_AND_STORAGE.md) | Judge bundle, facade, Parquet, repository mirror, local/cloud adapters |
| [`WEB_OPENAI_AND_ACCESSIBILITY.md`](WEB_OPENAI_AND_ACCESSIBILITY.md) | React, map UX, accessibility, Configured model analyst |
| [`TESTING_AND_RELEASE.md`](TESTING_AND_RELEASE.md) | Tests, E2E, static deployment, competition release |
| [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) | Task plan and completion report |

## Source-of-truth order

1. Explicit current goal.
2. Accepted ADR/versioned contract.
3. Current code and tests.
4. Commit-bound reports/manifests.
5. Human decisions.
6. README/general docs.

The repository contains historical compatibility code and immutable fixture
claims. Do not reinterpret a historical artifact through a newer upstream
contract without an explicit migration.

Update `CURRENT_STATE.md` at major goal/phase boundaries. Keep temporary phase
detail out of root `AGENTS.md`.
