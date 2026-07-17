# Phase 14.1.1 technical release gate

Gate run: 2026-07-17 UTC

TaxaLens starting revision: `e55bd968caf539f90351dcf4ccba2a62ef0fd2dc`

BioMiner working-tree revision observed by the boundary verifier:
`94fa1f634ee3c63917c05d78181dd3cf9ceff940`

## Outcome

Every required technical check passed. WebKit and Chromium used runtime libraries
extracted into temporary directories because the runner does not provide the
browser packages through its system package registry. Both real browser
processes launched and ran the product assertions. WebKit's Playwright host
package validator was skipped after its required shared libraries were supplied
to the temporary browser cache; this is an environment workaround, not a skipped
product test.

The first complete Python run found an undeclared HTML file inside the closed
judge fixture. The impact-study baseline is test infrastructure, not judge
evidence, so it was moved to `apps/web/e2e/fixtures/`. The Playwright study now
loads that file explicitly with `page.setContent()` and reloads the product
before the assisted session. This preserves both the closed-bundle invariant and
the measurement protocol.

The routed verification tests and visual snapshots were also brought into line
with the current fail-closed product route: a deep link first shows the
unavailable exact-source warning and the actionable reference workflow, while
the separate Flickr tab retains the blocked source context. Dashboard assertions
now use consensus counts rather than treating every event as a decisive outcome.

## Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Full Python suite | passed | 760 tests |
| Full Vitest suite | passed | 343 tests passed, 1 skipped; 108 files passed, 1 skipped |
| TypeScript | passed | `npm run check` |
| Native Ruff | passed | 104 files clean for check and format |
| Source-lock lint report | passed as designed | 46 historical findings across 14 source-locked files were reported, not rewritten |
| Production package build | passed | TypeScript, Vite, review-asset checks, 3 public review media |
| Static deployment build | passed | 67 files; base path `/taxalens/`; local pre-commit fingerprint `bf3c442…` |
| Playwright Chromium | passed | 46 passed, 1 intentionally skipped |
| Playwright Firefox smoke | passed | 1 passed |
| Playwright WebKit smoke | passed | 1 passed with temporary runtime libraries |
| Scripted impact protocol | passed | 1 Chromium test; 0 human participants and no human-productivity claim |
| Demo and judge-bundle verifier | passed | 30 artifacts, 36 records, 3 media |
| Provenance verifier | passed | manifest, session and migration records validated |
| BioMiner boundary verifier | passed with warnings | pinned `74a7d648…` remains available; local BioMiner is newer and has unrelated untracked files |
| Rights and attribution | passed | 3 review media and 6 public files validated |
| Static media tests | passed | 4 tests |
| Static deployment tests | passed | 3 tests |
| Bundle/media checks | passed | judge bundle, review assets and copied public media agree |
| Dependency audit | passed | npm reported 0 vulnerabilities |
| Python lock | passed | lock is current; locked dev sync would make no changes |
| Secret scan | passed after review | 522 heuristic matches were all expected non-secrets |
| Large-file scan | passed | 0 worktree files over 50 MiB; largest file 2,867,304 bytes |
| Repository hygiene | passed | no tracked key/model/database/cache paths; `git diff --check` clean |

## Secret-scan disposition

`detect-secrets` reported 518 high-entropy hexadecimal strings, two
high-entropy Base64 strings, one secret-keyword match and one basic-auth match.
The hexadecimal values are committed checksums, fingerprints and test
identifiers. The two Base64 matches are reviewer-control identifiers. The
secret-keyword match is the intentional `browser-key-must-not-work` rejection
case, and the basic-auth match is an intentional credential-bearing URI
rejection case. No AWS key, private key, Azure key, GitHub token or other usable
credential detector fired.

## Browser and environment commands

Chromium ran with temporary shared libraries under
`/tmp/taxalens-playwright-libs-20260716`. WebKit used temporary extracted
libraries under `/tmp/taxalens-webkit-libs-20260717`; no repository file or
system package was changed.

The explicit impact rerun wrote its disposable result to
`/tmp/taxalens-phase14-impact-run.json`. It records one scripted Chromium
protocol, three disposable Yes interactions, zero human participants, and
explicitly prohibits human-productivity, population-savings and scientific-
quality claims.

## Release boundary

This gate proves that the repository, static app, deterministic evidence bundle
and browser workflows execute and validate. It does not turn candidate records
into occurrences, role-suitable BioMiner reference rows into independent
taxonomic verification, raw scores into probabilities, scripted inputs into
human labels, or unavailable evaluation metrics into scientific results.
