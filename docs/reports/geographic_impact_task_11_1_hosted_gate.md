# Geographic Impact hosted replay gate

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-11.1.3`

## Result

The extended hosted verifier passed against the exact public `main` deployment at TaxaLens SHA `769ce9545c42ccaa8d8d6b9d2242d9e62e2359c8` and build fingerprint `7816144218d7a9038d339bd61422ea60bea0ca836c9d5c734cd8404aafaaa3c7`.

The replay was opened at <https://karikris.github.io/taxalens/> in a fresh Chromium context. It required no login, credentials, backend or cookies and made no request to an unexpected origin.

## Geographic path verified

1. Load the global Geographic Impact Lens.
2. Drill into Europe.
3. Drill into Sweden.
4. Select cell `87088660cffffff`.
5. Open record `flickr:55081300254` and its record-level mini-map.
6. Follow `Verify this result` and confirm the exact Flickr result remains unavailable for review rather than substituting another record.
7. Export the Sweden Geographic Impact checksum manifest.
8. Confirm the export signature is unavailable and `scientificClaimAllowed` is false.

The same fresh context also verified the public three-image reference campaign, local Can't view and Skip events, receipt export, reset, media hashes, static fallback and exact source fingerprint. The complete machine-readable receipt is `provenance/hosted_replay/hosted_geographic_impact_20260717T233921Z.json`.

## Commands

```text
node --check apps/web/scripts/verify-hosted-replay.mjs
cd apps/web && LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu npx playwright test --config=playwright.config.ts --project=chromium --workers=1 e2e/geographic-impact.journey.spec.ts
cd apps/web && TAXALENS_EXPECTED_SHA=769ce9545c42ccaa8d8d6b9d2242d9e62e2359c8 LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu npm run test:hosted
git diff --check
```

The subtask changes extend the hosted verifier and therefore require a second exact-fingerprint run after Task 11.1 is pushed and GitHub Pages publishes that task SHA. The pre-push receipt proves the currently deployed Geographic Impact behavior; it does not claim the not-yet-pushed commit is already hosted.
