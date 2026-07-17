# Geographic Impact hosted replay gate

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-11.1.3`

## Result

The extended hosted verifier passed after Task 11.1 was pushed, against the exact public `main` deployment at TaxaLens SHA `5ea4cc4822e67bc33052a8c1f47f65d779e654b8` and build fingerprint `a5d1d5495c47facfb158fac07695fa562b88ff58c55bd9ea8e5ed7603875c2ab`.

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

The same fresh context also verified the public three-image reference campaign, local Can't view and Skip events, receipt export, reset, media hashes, static fallback and exact source fingerprint. The authoritative post-push receipt is `provenance/hosted_replay/hosted_geographic_impact_20260717T234351Z.json`.

GitHub Actions run `29621374293` built and deployed the exact task SHA successfully. The pre-push behavioral receipt at SHA `769ce9545c42ccaa8d8d6b9d2242d9e62e2359c8` remains retained separately as evidence that the verifier extension was exercised before publication.

## Commands

```text
node --check apps/web/scripts/verify-hosted-replay.mjs
cd apps/web && LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu npx playwright test --config=playwright.config.ts --project=chromium --workers=1 e2e/geographic-impact.journey.spec.ts
cd apps/web && TAXALENS_EXPECTED_SHA=5ea4cc4822e67bc33052a8c1f47f65d779e654b8 LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu npm run test:hosted
git diff --check
```

Task 11.1 is closed at pushed SHA `5ea4cc4822e67bc33052a8c1f47f65d779e654b8`. The live replay and remote `main` resolved to that same SHA when the post-push receipt was recorded.
