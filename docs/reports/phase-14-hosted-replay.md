# Phase 14.1.3 hosted verification replay

The public replay at <https://karikris.github.io/taxalens/> passed the complete
hosted checklist on 2026-07-17 in a new Chromium browser context with no cookies
or stored origin state. The timestamped pre-push receipt records deployed source
`e55bd968caf539f90351dcf4ccba2a62ef0fd2dc` and build fingerprint
`bff4b5bd08d8dc67601e18262a5931488484106428949adebef7222495bd038e`.

| Hosted requirement | Verification |
| --- | --- |
| Public | Root returned HTTP 200 over HTTPS without an authentication challenge |
| No login | No login/sign-in control or password field was present |
| No credentials | Fingerprint says credentials are not required; no cookie, authorization or API-key request header was observed |
| Resettable | Reset returned the fresh replay to Mission |
| Campaign works | Cache prepared, verified media displayed, and disposable Can’t view and Skip events saved locally |
| Media hashes | All three media byte counts and SHA-256 digests matched both campaign items and the deployment file inventory |
| Export works | A v2 local review receipt downloaded with the two disposable outcomes and no scientific authorization |
| Static fallback | An unknown route returned the expected HTTP 404 fallback pointing to `/taxalens/` |
| Fingerprint matches | Source SHA, base path, evidence identities, flags and the fingerprint's own SHA-256 all validated |

`apps/web/scripts/verify-hosted-replay.mjs` makes the same check repeatable for an
explicit expected source SHA. It verifies the static contract and media over
HTTP before opening an incognito-equivalent fresh Playwright context. Browser
requests must remain same-origin and credential-free. The test does not retain
its disposable review events in a server, database or committed evidence
ledger.

The Phase 14.1 task push will create a newer Pages deployment. The verifier must
be rerun with that exact pushed SHA before the task is reported complete; the
pre-push receipt proves the currently deployed behavior and is not substituted
for the post-push source match.
