# Phase 1 report

## Scope

Implemented replay-oriented schema contracts, demo manifest contract, and smoke fixtures for deterministic demo verification.

## Branch and commits

- Starting SHA before Phase 1: `dbee4a15b3f8b7e10086095356c8281cc66f4691`
- Ending SHA after this phase: `6b2d8298f0c1ff4b0e9f5e2e2f1d8a6e9c5ddc8a`

## Files added

- `packages/contracts/src/replay_contracts.ts`
- `packages/contracts/src/index.ts`
- `demo/manifests/demo_manifest.example.json`
- `scripts/verify_demo.py`
- `demo/fixture/contract_smoke/README.md`
- `demo/fixture/contract_smoke/run_summary.json`
- `demo/fixture/contract_smoke/stage_metrics.json`
- `demo/fixture/contract_smoke/evidence_records.json`

## Contracts defined

- Run summary
- Stage metric
- Artifact inventory
- Query association
- Media identity
- Geographic assignment
- Candidate set summary
- Detection route
- Visual input
- Reference evidence
- Candidate score
- Comment mention
- Candidate set revision
- Evidence record
- Evaluation summary

## Verifiers added

- `scripts/verify_demo.py`

## Notes

- No real biological claim, metric, or media file is committed.
- No model weights, credentials, or source-image collections are committed.
- `Phase 13` remains excluded in the manifest example.
