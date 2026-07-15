# Phase 0 — product boundary report

## Outcome

Phase 0 audited the current TaxaLens product gap, reviewed the latest committed BioMiner handoff, and froze an artifact-first product boundary. TaxaLens remains a tested scientific compatibility library rather than a completed product, but the next implementation work now has a truthful, versioned boundary and a green strict BioMiner verifier.

## Repository identity

| Item | Value |
| --- | --- |
| TaxaLens starting SHA | `3b4e64ef724415845f1b6dbef45fe5ce1db56669` |
| Phase 0 numbered-task ending SHA | `c3f1fc70bc395df5be98c7aaf311596d5e468962` |
| Phase 0 numbered-task pushed SHA | `c3f1fc70bc395df5be98c7aaf311596d5e468962` |
| TaxaLens branch | `main` |
| BioMiner starting pin | `0561906d994d6b9e56e0b6405fdb68272759595f` |
| BioMiner reviewed handoff pin | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| BioMiner branch | `main` |
| `AGENTS.md` SHA-256 | `39d8bf1df80402d0cfb135d1093618b120f288f525a516196c3ceb6f3eb04ccb` |
| Primary Codex model | `gpt-5.6-sol` |
| Reasoning effort | `high` |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` |

The pasted goal recommended a task branch, while the explicit current user instruction required direct work on `main`. Under the repository instruction precedence, all Phase 0 commits were made and pushed directly to `main`. No history was rewritten and no force push occurred.

## Task commits

| Task | Commit | Pushed | Result |
| --- | --- | --- | --- |
| 0.1 Audit TaxaLens | `f770a37a6449b02da041c2317121e1c4b83cec44` | yes | product gap and stale upstream pin documented |
| 0.2 Audit recent BioMiner changes | `22730464e069f8c1e9dbbc43375046a664fe9860` | yes | Phase 13/14 availability and storage handoff audited |
| 0.3 Freeze migration boundary | `c3f1fc70bc395df5be98c7aaf311596d5e468962` | yes | artifact-first, facade-required boundary frozen |

## Boundary now enforced

- No further broad BioMiner source copying is approved.
- Integration priority is committed artifact, versioned schema, thin adapter, stable BioMiner command, small shared package, then copied source only with an explicit exception finding.
- TaxaLens product consumers must use a stable product facade with provenance and explicit availability.
- Target-aware evidence is the only product decision path.
- Family-first output is diagnostic/baseline evidence only.
- Phase 14 search hits and source-media rows are candidates, not occurrences, labels, verified references, or successful classifications.
- Only human-verified, rights-checked references may support a decision.
- Unreviewed results, missing artifacts, calibrator absence, and blocked evaluation stay explicitly unavailable.
- Large BioMiner data must arrive through an explicit content-addressed handoff with expected SHA-256, embedded inventory, full source SHA, and verified receipt.

## BioMiner handoff finding

BioMiner current HEAD is one commit newer than the previous TaxaLens pin. The new commit adds a deterministic storage handoff implementation and stable build/upload/receive CLI commands. This fills the engine-side transfer-code gap without requiring TaxaLens to copy the implementation.

Committed Phase 14 compact metadata records 76,485 query hits, 13,501 canonical candidate photos, 76 located clusters, 838 eligible source-media candidates, zero human-verified source media, a candidate shortfall of 247, and a human-verified shortfall of 490. These are planning and workload facts only.

Real reviewed Papilio Phase 13 result artifacts, verified Phase 14 references, B0-B16 ablation results, a selected calibrator, and final Phase 14 metrics remain unavailable.

## GitHits evidence

| Task | Query focus | Repositories inspected | Licence posture |
| --- | --- | --- | --- |
| 0.1 | evidence-driven browser replay and observability | `nuumz/vinyan`, `intentweave/intentweave` | Apache-2.0; no code copied |
| 0.2 | deterministic content-addressed handoff audit | `latent-to/optima`, `iiyazu/Cross-Muse` | Apache-2.0 and MIT; no code copied |
| 0.3 | versioned product facade and diagnostic legacy isolation | `arxhive/pss-plugin`, `Martian-Engineering/lossless-claw` | MIT; no code copied |

Complete query, adoption, rejection, reason, solution, and licence details are in `provenance/githits.jsonl`.

## Verification

- TaxaLens full suite: `533 passed`.
- BioMiner focused storage-handoff, target-verification, and Phase 14 pilot suite: `19 passed`.
- `scripts/verify_provenance.py`: passed.
- `scripts/verify_demo.py`: passed for the current contract-smoke fixture.
- `scripts/verify_biominer_boundary.py --biominer-path ../BioMiner`: passed.
- GitHits JSONL validation: passed.
- `git diff --check`: passed.
- TaxaLens `main` matched `origin/main` at the numbered-task completion SHA.

The strict boundary verifier warns that the BioMiner worktree contains untracked local configuration, notes, logs, and counters. Those paths were not read as authoritative artifacts, modified, staged, or imported.

## Rights and accessibility

No media, source-image collection, model weight, secret, or external code was added in Phase 0. Rights scope is unchanged. Accessibility verification is not applicable to this documentation-only phase because no web surface exists yet.

## Known limitations and next safe task

- The primary judge replay still does not exist.
- The Python project is not packaged and has no lockfile or CLI.
- No product facade exists.
- The current demo is a schema-smoke fixture, not the truthful Papilio judge bundle.
- The four product screens, OpenAI analyst replay, exports, guided tour, E2E coverage, and static deployment are absent.
- Human scientific review remains required and blocked work is not reported complete.

The next safe task is 1.1: package the current implementation reproducibly without adding model downloads, cloud credentials, or a live-service dependency.
