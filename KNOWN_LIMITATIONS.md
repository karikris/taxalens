# Known limitations

This document describes the current repository state. It distinguishes tested
capability from target architecture so demonstrations and submission materials
do not overstate what TaxaLens can do.

## Capability status

| Area | Current status | Evidence |
| --- | --- | --- |
| BioMiner artifact adaptation | Demonstrated | Deterministic Python adapters and fixture-backed tests under `packages/replay/` |
| Replay contracts | Demonstrated | TypeScript contracts under `packages/contracts/` and contract-smoke JSON fixtures |
| Demo and provenance verification | Demonstrated | `scripts/verify_demo.py`, `scripts/verify_provenance.py`, and `scripts/verify_biominer_boundary.py` |
| Research Mission | Planned | No researcher-facing application exists yet |
| Evidence Observatory | Planned | Stage metrics are adapted, but no visual pipeline interface exists yet |
| Evidence Lens | Planned | Record-level contracts exist, but no interactive record view exists yet |
| Butterfly Dashboard | Planned | No aggregate dashboard or chart implementation exists yet |
| Hosted judge replay | Planned | No hosted, resettable public application exists yet |
| Production control/data planes | Architecturally supported | Supabase and Backblaze B2 are specified boundaries but are not integrated here |
| Live vision | Upstream capability | BioMiner remains responsible; TaxaLens has no model runtime or installation flow |

## Product surface

- There is currently no `apps/` web application and no `services/` API.
- The primary judge journey, navigation, loading states, failure states, and
  progressive disclosure have not been implemented.
- There are no browser, accessibility, responsive-layout, or keyboard journey
  tests.
- The repository does not yet provide `taxalens demo replay --open` or an
  equivalent packaged command.

## Replay data

- The committed demo pack is a contract-smoke fixture, not the required
  judge-quality frozen *Papilio demoleus* replay.
- No golden hero evidence record currently demonstrates duplicate handling,
  full-frame variants, competitor evidence, comment-driven candidate expansion,
  zero re-encoding, and complete lineage in one reviewed record.
- No licensed thumbnail pack or media attribution bundle is present.
- Replay adapters currently parse deterministic JSON fixtures. Parquet artifact
  paths are reported but not decoded by the Python replay adapters.
- The hosted replay checksum, expected-output, schema, and rights gates are not
  yet assembled into one submission verifier.

## Scientific workflow

- TaxaLens does not execute BioMiner acquisition, YOLOE routing, BioCLIP
  encoding, calibration, or target-aware scoring. It consumes committed
  BioMiner artifacts through adapters.
- Live Flickr, GBIF, iNaturalist, OpenAI, Supabase, and Backblaze B2 calls are not
  implemented in this repository.
- No current TaxaLens artifact demonstrates the required controlled
  manual-versus-TaxaLens impact study.
- No benchmark report establishes TaxaLens throughput, peak memory, cache reuse,
  or cost. Any future projections must remain labeled as estimates until
  measured.

## OpenAI workflow

- Natural-language research planning, structured run approval, analytical tool
  orchestration, comment interpretation, evidence explanation, and Agent Trace
  presentation are not implemented.
- Fixed OpenAI evaluation cases and exact model/prompt provenance are not yet
  present.
- No replayed OpenAI structured outputs are included in the current smoke
  fixture.

## Infrastructure and operations

- Supabase migrations, row-level security policies, leases, and idempotent work
  registration are not implemented.
- Backblaze B2 artifact publication, immutable part writing, and manifest-last
  commit behavior are not implemented.
- There is no deployment configuration, public URL, reset mechanism, or uptime
  monitoring.
- Optional Apple MPS, NVIDIA CUDA, and CPU live-model smoke paths are not exposed
  through TaxaLens commands.

## Provenance and submission readiness

- BioMiner consumption remains pinned to
  `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`; newer upstream work is not
  implicitly available.
- The current migration manifest covers the implemented replay adapters, but a
  complete Build Week submission provenance bundle is still being assembled.
- Judge guide, data-rights, third-party-model, AI-provenance, collaboration,
  Build Week delta, presentation, and video deliverables remain incomplete or
  absent unless separately committed after this document.

## Claim policy

Until the relevant evidence is committed and verified, TaxaLens must not claim
that it provides a hosted judge replay, production cloud operation, measured
researcher time savings, live model execution, comprehensive biological
coverage, or verified biodiversity occurrences.
