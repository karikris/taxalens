# TaxaLens judge web application

This Vite application is a static, credential-free replay client. Its public files are copied directly from the checksum-verified fixture at `demo/fixture/papilio_pilot`; the initial shell loads only `judge_bundle.json` and its inventoried run summary.

The app uses strict TypeScript, React, React Aria Components, Vitest with Testing Library, and Playwright. DuckDB-Wasm is pinned behind a lazy browser-only module and is not started by the shell. There is no live backend in the replay path.

The production build is written to the repository-level ignored `dist/web` directory with relative asset URLs. The build verifier compares every copied fixture byte, byte count, and SHA-256 digest with the source judge bundle.

The design system in `src/design-system` separates literal palette values from semantic aliases and component rules. Its evidence primitives keep candidates distinct from verified occurrences, raw scores distinct from calibrated probabilities, and loading, blocked, review, abstention, failure, uncertainty, and unavailable states legible without relying on color alone. Scientific figures require a title, prose description, evidence tier, and caption. The keyboard-operable image comparison primitive is available for later licensed image pairs but is not rendered by the metadata-only pilot.
