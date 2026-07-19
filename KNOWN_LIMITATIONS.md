# Known limitations

This document describes the current prototype-only product state. TaxaLens has
a working hosted judge replay, but the replay deliberately stops before a
reviewed biological conclusion.

## Current demonstrated capability

| Area | Current status | Evidence |
| --- | --- | --- |
| Hosted judge replay | Demonstrated | Public static, resettable GitHub Pages product and local `uv run taxalens demo replay --open` |
| Product surfaces | Demonstrated | Research Mission, Observatory, Evidence Lens, Dashboard, Agent Trace, exports, and guided tour |
| BioMiner integration | Demonstrated, artifact-first | 20 pinned prototype JSON artifacts, four pinned analytics Parquet artifacts, thin adapters, and migration manifest |
| Prototype evidence | Demonstrated with limitations | 81 provider-supported frozen references, B0–B16 retrieval experiments, B13 raw-margin policy, and staged inference metadata |
| Release decision | Demonstrated, prototype-only | 14 / 14 entry gates and `GO_PROTOTYPE_ONLY` for `explicit_prototype` |
| Research analyst | Demonstrated as stored replay | Exact `configured-model` contract, 12 read-only tools, and 31 deterministic evaluation cases |
| Production scientific result | Not demonstrated | Hero remains `awaiting_human_review`; reviewed accuracy, calibration, and final evaluation are unavailable |

## Scientific limitations

- All 81 frozen prototype support rows are provider-supported; zero are
  independently human taxonomically verified.
- Seventy-nine references are research-only, two lack owner evidence, and no
  reference image bytes are committed or authorized for public display.
- B13 target scoreability and raw margins are retrieval diagnostics, not
  classification accuracy or probabilities. No calibrator was fitted from
  independently reviewed labels.
- The staged 13,496-record distribution is operational evidence, not occurrence
  evidence, population prevalence, or reviewed model performance.
- The staged `0.02` diagnostic abstention rule is distinct from the selected
  `0.10` raw-margin prototype policy.
- YOLOE is a gate and router only. Its routing accuracy is not independently
  validated, and the judge fixture contains no hero detection artifact.
- The hero record has no committed image, full-frame transformation, embedding,
  candidate score, calibrated decision, comment revision, strongest-competitor
  rank, or reviewed label.
- `GO_PROTOTYPE_ONLY` does not authorize a production default, scientific
  release, public reference images, or scientific claim.

## Product and infrastructure limitations

- The primary judge path is a deterministic static replay, not a live
  acquisition, inference, or publication service.
- No production Supabase or Backblaze control/data plane is required or
  demonstrated by the judge replay.
- The public analyst is a checksum-verified stored output. The repository has a
  server-only live Configured model contract, but no public secret-bearing backend route.
- Live Flickr, GBIF, iNaturalist, OpenAI, YOLOE, BioCLIP, calibration, and
  publication workflows require a separate approved environment.
- The pilot covers one taxon and one stored analyst session.
- A controlled manual-versus-TaxaLens impact study is not yet committed, so
  time saved, accuracy gained, and work avoided remain unclaimed.
- Build and artifact checksums are not cryptographically signed.

## Test-environment limitation

The Phase 15.3 workspace passes Python, Vitest, TypeScript, fixture,
provenance, import-receipt, static-build, and deployment verification. Chromium
cannot launch locally because the host lacks `libnspr4.so`; the failure occurs
before page or product code executes. CI or another host with Playwright system
libraries is required for the browser journey.

## Remaining human work

- Independently review and taxonomically verify attributable reference labels.
- Resolve research-only and missing-owner rights before any public image use.
- Freeze leakage-safe groups after review, fit calibration on reviewed labels,
  and publish untouched final-test metrics.
- Validate YOLOE routing independently and complete missing route support.
- Run the controlled researcher productivity study.
- Record the final Build Week `/feedback` session ID, public video, and
  submission materials.

## Claim policy

TaxaLens may claim a working, credential-free, artifact-first prototype replay.
It must not claim a verified occurrence, production classifier, calibrated
probability, reviewed accuracy, scientific release, public reference-image
authorization, measured productivity improvement, or comprehensive biological
coverage until the corresponding committed gates pass.
