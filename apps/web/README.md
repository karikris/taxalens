# TaxaLens judge web application

This Vite application is a static, credential-free replay client. Its public files are copied directly from the fixture at `demo/fixture/papilio_pilot`. The evidence facade validates the authoritative judge-bundle schema at runtime, checks the inventory and payload roots, then verifies every inventoried artifact's byte count and SHA-256 digest before the shell receives any replay value.

The app uses strict TypeScript, React, React Aria Components, Vitest with Testing Library, and Playwright. DuckDB-Wasm is pinned behind a lazy browser-only module and is not started by the shell. Section loading prefers a verified Parquet artifact when a Wasm reader is available and otherwise reports an explicit verified-JSON fallback. There is no live backend in the replay path.

The production build is written to the repository-level ignored `dist/web` directory with relative asset URLs. The build verifier compares every copied fixture byte, byte count, and SHA-256 digest with the source judge bundle.

The design system in `src/design-system` separates literal palette values from semantic aliases and component rules. Its evidence primitives keep candidates distinct from verified occurrences, raw scores distinct from calibrated probabilities, and loading, blocked, review, abstention, failure, uncertainty, and unavailable states legible without relying on color alone. Scientific figures require a title, prose description, evidence tier, and caption. The keyboard-operable image comparison primitive is available for later licensed image pairs but is not rendered by the metadata-only pilot.

The shared shell in `src/shell` keeps target identity, bundle ID, and both source revisions visible across Mission, Observatory, Evidence Lens, and Dashboard hash views. Reset returns to Mission and reloads the same local bundle. The guided tour uses a labelled, dismissible React Aria dialog with managed focus; global load failures remain in one alert above the current view while navigation and retry stay available.

The Mission view projects its hierarchy, range hypotheses, candidate policy, reference shortfalls, budgets, stopping conditions, and prerequisites only from the checksum-verified replay artifacts. Its React Aria controls let a judge inspect a bounded draft, including replay-only execution and an optional device annotation. Changing the target away from the pinned species produces an explicit no-fixture state rather than borrowing evidence from the submitted bundle.

Plan generation is a pure local TypeScript operation with a fixed plan version and no OpenAI, network, clock, or random input. The validator refuses targets without a verified fixture, budgets that cannot contain the submitted replay, candidate limits that would prune an eligible regional species, undeclared regions, unsupported policies, and live execution. A valid plan preserves the artifact-provided stage order, names every unavailable stage and future artifact role, keeps geography soft and unknown when missing, and leaves explicit human approval outstanding; it never launches work.

## Visual regression baselines

The committed Playwright baselines cover focused verification states, every primary route at the 1280×720 judge viewport, and reduced-motion interaction states. They are strict Chromium-on-Linux comparisons: no pixel-difference tolerance is configured. Browser time, locale, color scheme, device scale, viewport, and motion preference are fixed in each visual test. Timestamp elements and geographic map SVGs are masked only when they enter a captured viewport.

Run the baselines without changing them:

```bash
npm run test:visual
```

Update baselines only for an intentional reviewed UI change, from a Linux environment using the locked dependencies and repository Playwright version:

```bash
npm run test:visual:update
npm run test:visual
```

Before committing an update:

1. Inspect every changed PNG and any `actual`, `expected`, and `diff` image under `test-results`.
2. Confirm that scientific availability, control enablement, lineage, and review-state changes are intentional—not timing or loading drift.
3. Keep deterministic evidence visible. Add a mask only for a genuinely volatile map or timestamp region.
4. Run `npm run test:visual` again without the update flag and require a clean pass.
5. Check `git status` and commit only the intended Linux snapshots with their test or styling change.

Do not regenerate the `chromium-linux` files on another operating system or accept a new baseline solely to make a failure disappear.
