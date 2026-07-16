# Phase 15 report — prototype release boundary and acceptance

Phase 15 was completed on **2026-07-16** from `515c7f9` through the commit
containing this report. The non-self-referential final commit is available with:

```bash
git log -1 --format=%H -- docs/reports/phase-15-report.md
```

The reviewed BioMiner boundary remains
`67c1c2a3a2c9b909b256b3094913af342f4ccbed`.

## Outcome

TaxaLens now enforces and explains a fail-closed Phase 15 decision:
`GO_PROTOTYPE_ONLY` is available only for `explicit_prototype` when all
fourteen required gates pass. Production-default changes, scientific release,
public reference-image display, probabilities, accuracy, and scientific claims
remain blocked in every outcome.

The release boundary is executable in Python, verified while building and
loading the truthful fixture, exposed through strict read-only analyst tools,
covered by deterministic evaluations, and included in portable local exports.

## Immutable work items

| Task | Commit | Delivered boundary |
| --- | --- | --- |
| 15.1 | `4892786` | Added the deterministic fourteen-gate `GO_PROTOTYPE_ONLY` / `NO_GO` evaluator |
| 15.2 | `8fd4e55` | Added three prototype tools, 30 tool-evaluation cases, and prototype export receipts |
| 15.3 | current report commit | Updated judge documents, ran full acceptance, and verified deployment behavior |

## Agent and export boundary

- 12 closed-schema read-only research tools are available.
- `inspect_prototype_evidence` exposes only aggregate reference, runtime,
  staged, and rights facts.
- `inspect_prototype_policy` keeps B0/B13 scoreability, selected `0.10`, staged
  `0.02`, raw-score, accuracy, and calibration semantics distinct.
- `inspect_prototype_release` returns `GO_PROTOTYPE_ONLY` only for
  `explicit_prototype`; broader requested modes return `NO_GO`.
- The deterministic evaluation contains 30 tool cases plus the stored public
  replay and 247 named checks.
- Research outputs and Evidence Lens audit exports each prepare six
  deterministic local files. Their prototype receipts add no scientific claim.

## Full acceptance matrix

| Gate | Result |
| --- | --- |
| Python | 670 / 670 passed |
| Vitest | 111 / 111 passed |
| Focused Task 15.2 tests | 32 / 32 passed |
| TypeScript | passed |
| Deployment contract tests | 3 / 3 passed |
| Production npm audit | 0 vulnerabilities |
| Truthful demo | passed: 25 artifacts, 29 records, 0 media |
| Provenance | passed |
| Prototype import receipt | 20 / 20 verified |
| Analytics import receipt | 4 / 4 verified |
| BioMiner boundary | passed at `67c1c2a3…`; six pre-existing untracked paths preserved |
| Static Pages artifact | passed: 50 files at `/taxalens/` |
| Chromium judge journey | host-blocked before launch: missing `libnspr4.so` |

The Chromium result is an environment dependency failure, not a passing browser
test and not a product-code failure. The browser process exits before loading a
page. CI or a host with Playwright’s system libraries remains the required
browser acceptance environment.

## Deployment

Pushes to `main` build the exact event commit, run the deployment contract
tests, create and verify the public artifact, and deploy it to GitHub Pages.
The authoritative deployed source and root checksum are always:

<https://karikris.github.io/taxalens/build-fingerprint.json>

The manifest must report `/taxalens/`, public and resettable `true`, login,
backend, and credentials required `false`, the current bundle ID, fixture
TaxaLens source, BioMiner source, sorted file receipts, and one root
fingerprint. This report deliberately does not copy its own deployment SHA into
the same commit.

## Release decision

| Requested mode | Decision |
| --- | --- |
| `explicit_prototype` | `GO_PROTOTYPE_ONLY` |
| `production_default` | `NO_GO` |
| `scientific_release` | `NO_GO` |
| `public_reference_image_display` | `NO_GO` |

## Remaining human work

- Independently verify taxonomic labels and attribution/rights.
- Resolve the 79 research-only rows and two missing-owner records before any
  public reference-image use.
- Fit calibration only from independently reviewed leakage-safe labels.
- Publish untouched reviewed final-test metrics before a scientific release.
- Validate YOLOE routing independently and complete route/visual-input gaps.
- Run the controlled productivity study and finish the human video/submission
  deliverables.

Every numbered Phase 15 task records GitHits availability, exact upstream
origin, the human decision, tests, GPT-5.6 Codex provenance, and a direct-main
pushed commit.
