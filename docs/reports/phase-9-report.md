# Phase 9 report — judge replay and guided tour

Phase 9 was completed on **2026-07-16** from the Phase 8 report at
`35170676063844dd6de5c43122d2c3a251965333` through the final numbered task at
`90a9a7e8d500410f1451d1245b9c700242c4d0df`.

## Outcome

TaxaLens now has one credential-free judge path that works both locally and as a public static
site. One command verifies the submitted evidence, builds the production client, serves it only on
loopback, waits for readiness, and optionally opens the browser. Inside the application, a
resettable and keyboard-operable 90-second tour leads through Research Mission, Observatory,
Evidence Lens, Dashboard, and Export.

The same route is covered by a coherent real-browser test and is deployed at
<https://karikris.github.io/taxalens/>. The hosted artifact requires no login, backend, credential,
model request, or live scientific API. Its public build fingerprint binds the exact TaxaLens commit
and Pages base path to a sorted SHA-256 inventory of all other deployed files.

## Immutable task record

| Task | Commit | Delivered boundary |
| --- | --- | --- |
| 9.1 | `93d6019e2fd25db8460e05ec7f5666f9f4caf9c3` | One-command verified loopback replay with optional browser launch and explicit provenance |
| 9.2 | `15a96ccd4eb39a2d09eb1aa5b7389b008989a8ee` | Exact five-step, 90-second, accessible guided judge tour |
| 9.3 | `da8e36fc56459e50ee807864fd83bf17637e6cd9` | One coherent Playwright judge journey from launch through parsed export |
| 9.4 | `90a9a7e8d500410f1451d1245b9c700242c4d0df` | Public GitHub Pages workflow, deterministic fallback, and exact artifact fingerprint |

Every numbered task was independently committed and pushed before the next task. Each task has a
GitHits record and a BioMiner boundary snapshot. The commits preserve the required origin,
human-decision, test, and AI-assistance disclosures.

## One-command local replay

The exact judge command is:

```bash
uv run taxalens demo replay --open
```

Before serving anything, the command runs the truthful demo verifier, including semantic fixture
checks and every committed checksum. It produces the locked Vite build, runs the static build
verifier, and byte-compares the copied evidence artifacts with their source fixture. If the locked
web dependencies are missing, it installs them with `npm ci`; otherwise it does not repeat the
installation.

The server exposes only `dist/web`, binds to `127.0.0.1`, waits for an HTTP readiness probe, and
opens the browser only after the probe succeeds. The default port is 4173, while an explicit zero
selects an ephemeral port. Interrupt and error paths shut down the server and close its socket.

The startup receipt prints:

- the current TaxaLens source SHA;
- the fixture TaxaLens SHA;
- pinned BioMiner SHA `75461d9c065af0cd96b41cd1f845c2e920f7ae34`;
- bundle ID `papilio-demoleus-pilot-75461d9c-v1`;
- 24 artifacts, 20 sections, 6 unavailable sections, 29 section records, and 0 media items;
- the `awaiting_human_review` hero state;
- the served URL and explicit no-credential state.

Browser opening and server lifecycle are dependency-injected for unit tests. The exact command was
also exercised with a harmless browser command, an HTTP 200 probe, and clean termination.

## Guided judge tour

The tour contains exactly five steps and a suggested total of 90 seconds:

| Step | Suggested time | Destination |
| --- | ---: | --- |
| Research Mission | 15 seconds | Deterministic mission and replay launch |
| Observatory | 20 seconds | Thirteen-stage evidence pipeline and analytics |
| Evidence Lens | 25 seconds | Record provenance, visual-input boundaries, competitors, and uncertainty |
| Dashboard | 20 seconds | Research workload and unavailable evaluation state |
| Export | 10 seconds | Five deterministic research-output receipts |

The React Aria modal supports start, resume, previous, reset, skip, finish, and replay. Visiting a
step is distinct from completing the route. Focus is contained while the dialog is open and is
returned on dismissal. The Export action navigates to Dashboard and focuses the research-output
panel through a bounded DOM observer fallback. Full replay reset clears the tour and application
state without local storage. Reduced-motion and narrow-viewport behaviour are preserved.

Agent Trace remains the fifth normal product navigation item and is not misrepresented as one of
the five required tour destinations.

## Coherent end-to-end replay

The Phase 9 Playwright flow exercises one continuous judge journey against the real production
build and committed fixture. It:

1. blocks any cross-origin HTTP request;
2. opens the application and starts the five-step tour;
3. visits Observatory and confirms all 13 pipeline stages;
4. opens the committed final lineage record;
5. visits Evidence Lens and opens the verified discovery record;
6. switches to the masked full-frame input without claiming a produced scientific mask;
7. exposes *Papilio memnon* as a candidate and keeps strongest-competitor ranking unavailable;
8. verifies geographic uncertainty and unavailable calibrated output;
9. opens Dashboard and follows the Export tour step to its focus target;
10. prepares all five local outputs, downloads the evaluation report, and parses its JSON;
11. requires zero reviewed metrics, a blocked Phase 14 state, a 490-item human-review shortfall,
    seven unavailable evaluation fields, and `scientificClaim: false`;
12. resets and makes the complete judge route replayable.

This flow supplements the 20 focused browser contracts rather than duplicating them. The complete
Chromium suite contains 21 passing tests.

## Public static deployment

The Pages workflow runs on pushes to `main` and manual dispatch. It separates the build and deploy
jobs and grants only the permissions needed by each job. Checkout, Node setup, Pages configuration,
artifact upload, and Pages deployment actions are pinned to reviewed immutable commit SHAs. The
build verifies that checked-out `HEAD` is exactly the triggering `github.sha`, installs from
`package-lock.json`, tests the deployment contract, and uploads only `dist/web`.

The workflow derives the base path from GitHub Pages instead of hard-coding the repository name.
The generated artifact includes:

- `index.html` and the byte-verified evidence/client build;
- an empty `.nojekyll` marker;
- a deterministic `404.html` redirect to the declared base path;
- `build-fingerprint.json`.

The fingerprint manifest records the exact source SHA, Pages base path, bundle ID, fixture
TaxaLens SHA, pinned BioMiner SHA, and explicit public, resettable, no-login, no-backend,
no-credential state. It inventories every other regular file with its relative path, byte count,
and SHA-256 checksum. The root fingerprint is the SHA-256 of the canonical manifest payload.
Preparation and verification reject symbolic links, hard links, non-regular entries, missing or
changed fallback files, fixture-identity drift, source-SHA drift, inventory drift, and contract
flag changes.

GitHub Actions run `29461056557` completed successfully for Task 9.4. The live deployment reports:

| Field | Deployed value |
| --- | --- |
| Source SHA | `90a9a7e8d500410f1451d1245b9c700242c4d0df` |
| Build fingerprint | `9f81518904d4e3e2f76cf045b1ff5c717da9bf68e30c2587426150a26b40a82f` |
| Fingerprinted files | 49 |
| Base path | `/taxalens/` |
| Public | `true` |
| Login required | `false` |
| Backend required | `false` |

The live root returned HTTP 200. The public manifest exactly matched the final local artifact, and
an unknown route returned the committed fallback pointing to `/taxalens/`.

These values identify the final numbered-task artifact. The workflow intentionally redeploys every
new `main` commit, so pushing this phase report advances the hosted source SHA and fingerprint while
leaving the verified replay content and deployment contract unchanged.

## Phase gates

The final Phase 9 gate passed:

- exact local replay command with readiness, HTTP 200, optional opener, and clean shutdown;
- Node deployment contract tests — 3 passed, including tamper and source-drift rejection;
- Vitest — 110 passed across 48 files;
- strict TypeScript project check;
- production Vite build and byte-exact 24-artifact static verification;
- deterministic deployment build and verification — 49 files at `/taxalens/`;
- Chromium Playwright — 21 passed;
- `uv run --locked pytest` — 633 passed;
- `npm audit --omit=dev` — zero vulnerabilities;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification at the pinned SHA with per-task snapshots;
- GitHits JSONL validation and `git diff --check`;
- successful GitHub Pages build, artifact upload, and deployment;
- live HTTP, fingerprint, and 404 fallback verification.

The repository-wide Ruff audit continues to have the previously recorded 209 findings in
mechanically preserved BioMiner modules and tests. Phase 9 did not sweep those provenance-sensitive
files.

## BioMiner boundary decision

BioMiner remained on `main` at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Phase 9 searched the pinned repository for CLI,
product-tour, Playwright, and static-hosting implementations before adding missing TaxaLens code.
Its CLI structure informed the one-command replay boundary, but it contains no applicable guided
tour, browser E2E, or hosted-replay deployment implementation.

No BioMiner code was copied in Phase 9, and BioMiner itself was not modified. Its pre-existing
untracked configuration, documentation, query-term, and log paths remained untouched and outside
the TaxaLens evidence boundary.

## Accepted limitations and Phase 10 handoff

- The hosted product is a deterministic replay, not a live acquisition or inference service.
- The public build fingerprint is checksum-bearing but not cryptographically signed.
- GitHub Pages cache headers can briefly retain a previous artifact after deployment.
- The 404 fallback returns an HTTP 404 before its browser redirect, as expected for static Pages.
- No rights-cleared image, detector result, transformed frame, embedding, visual score, calibrated
  probability, reviewed label, ranked competitor, or final scientific evidence record is committed.
- The stored Configured model session remains a stored output with no live call.

Phase 10 should now make this completed product slice legible to judges: lead the README with the
problem and product, document the 90-second and technical routes, preserve the no-credential and
scientific boundaries, and finish with one exact product-slice report spanning the starting SHA,
deployed SHA, tests, evaluation, blocked claims, human work, and recommended next goal.
