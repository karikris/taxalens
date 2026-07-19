# Git, direct-main workflow, and provenance

## Current active-goal policy

The observed Geographic Impact goal requires:

- work directly on `main`;
- no feature branch;
- no pull request;
- one commit per numbered subtask;
- push `main` after every completed task;
- no force-push;
- no amendment or history rewrite.

A later explicit goal may override this. Never infer policy from an old report.

## Start of every task

When the worktree is clean and no other session owns work:

```bash
git switch main
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
git pull --ff-only origin main
```

When dirty:

- do not pull or switch;
- inspect changed paths and task reports;
- identify session ownership;
- work only in non-overlapping files when safe;
- stop on overlap.

For BioMiner integration:

```bash
git -C ../BioMiner status --short
git -C ../BioMiner branch --show-current
git -C ../BioMiner rev-parse HEAD
```

Do not modify or commit the BioMiner tree from TaxaLens work unless explicitly
requested.

## Root AGENTS policy

`.gitignore` currently ignores `AGENTS.md`.

Therefore:

- compare any local root file before replacing it;
- do not assume GitHub's 404 means no local instructions exist;
- docs under `docs/agents/` are trackable unless separately ignored;
- installing this pack during an active goal is a repository change and needs
  its own safe task/commit if the user wants it tracked.

## Dirty-worktree prohibitions

Never:

```text
git reset --hard
git restore .
git checkout -- .
git clean -fd
git stash another session's work
git add -A without reviewing every path
```

Do not mass-format, rename, regenerate fixtures, or rebuild deployment output
across another session's files.

## Commit boundaries

For the current goal:

- each subtask gets one focused conventional commit;
- do not mix code, unrelated docs, generated snapshots, and refactors;
- run targeted tests before commit;
- run the task gate before push;
- push after the final subtask/report of the task.

Typical subjects:

```text
feat(impact): ...
fix(map): ...
test(export): ...
docs(geography): ...
perf(impact): ...
chore(release): ...
```

## Current trailer pattern

Use exact values, never placeholders:

```text
AI-Assistance: OpenAI Codex
AI-Primary-Model: exact-model-id
AI-Reasoning-Effort: exact-value
AI-Reasoning-Mode: standard | pro
AI-Session: exact-session-id
Build-Week-Scope: new | modified-existing
Origin-Repository: karikris/BioMiner | none
Origin-Commit: full-sha | none
GitHits-Log: provenance/githits.jsonl#task-id
Human-Decision: concise decision
Human-Reviewed-By: Kris Kari
Tests: exact commands and results
```

Add Valyu/source records when the task uses external authoritative research.

Never fabricate:

- model or reasoning mode;
- session ID;
- human review;
- source SHA;
- test count;
- benchmark;
- deployment result;
- push result.

Do not use an AI model as Git co-author unless explicitly requested.

## Before committing

Run required focused checks, then:

```bash
git diff --check
git status --short
git diff --stat
git diff --cached --stat
```

Inspect the complete staged diff.

Confirm no staged:

- secrets or `.env`;
- private/restricted source media;
- signed URLs;
- IndexedDB/local databases;
- node modules;
- build/deployment output not meant for source control;
- caches or test artifacts;
- unreviewed unrelated work;
- regenerated fixture bytes without updated manifests.

## Push

- Push only at the required task boundary.
- Verify remote `main` SHA.
- If rejected, do not force, rebase silently, or create a branch. Report the
  divergence and preserve local commits.
- Do not deploy or tag automatically unless requested.

## Provenance

Maintain current repository provenance:

```text
BUILD_WEEK_BASELINE.md
BUILD_WEEK_DELTA.md
CODEX_COLLABORATION.md
AI_PROVENANCE.md
HUMAN_DECISIONS.md
UPSTREAM_BIOMINER.md
provenance/githits.jsonl
provenance/commits.jsonl
provenance/model_usage.jsonl
provenance/review_attestations.yaml
provenance/biominer_migration_manifest.yaml
docs/reports/
submission/
```

Every task/phase report records:

- starting and ending SHA;
- subtask commits;
- pushed SHA;
- BioMiner pins;
- schemas and artifacts;
- exact tests;
- GitHits/Valyu status;
- rights and accessibility;
- human/live evidence unavailable;
- allowed and blocked claims.

Historical reports are immutable records of their ending SHA. Add a new report
rather than rewriting old evidence through current state.
