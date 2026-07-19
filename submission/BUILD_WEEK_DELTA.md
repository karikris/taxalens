# TaxaLens Build Week delta

This disclosure separates the pre-existing TaxaLens/BioMiner research prototype
from the Verification product work and the subsequent Geographic Impact Lens.
It is a Git change ledger, not an authorship estimate, productivity measure or
scientific-result claim.

## Comparison boundary

| Boundary | Commit |
| --- | --- |
| Pre-existing TaxaLens product at goal start | `d728618fc2506054c71e726f943a845cdd2f61eb` |
| Completed Verification implementation | `94158393c9d3886143b432ecc4fbc5f783829c3b` |
| Completion report measurement endpoint | `30a4994` |
| Geographic Impact starting SHA | `e85b0d225cfdad4932de95d745b936ae85a61097` |
| Geographic Impact implementation endpoint | `6444a5af8acd0b1f6803f704f43e76d6af3a7c43` |
| Geographic Impact report commit | `e4edc55` |
| BioMiner implementation context for Verification | `94fa1f634ee3c63917c05d78181dd3cf9ceff940` |
| Immutable BioMiner judge-evidence pin | `74a7d648a562efa744e6502ef504a23b63b4e02f` |
| BioMiner baseline-geography artifact pin | `247b42f3206d48bb79e2dbf97c5a92e4f207ae71` |
| BioMiner Flickr-geography artifact pin | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |

The non-self-referential Git range from `d728618…` through `30a4994` contains
133 commits and changes 366 files: 76,141 physical text-line insertions, 2,409
physical text-line deletions, and 21 binary-file changes. These are Git diff
statistics, not effective lines of code, unique authored lines or a model
attribution. They include tests, schemas, fixtures, campaign packets, reports
and generated/checksummed artifacts.

The separate non-self-referential Geographic Impact range from `e85b0d2…`
through `6444a5a…` contains 166 commits and changes 331 files: 56,560 physical
text-line insertions, 679 physical text-line deletions and 26 binary-file
changes. The same limitations apply: these are Git diff statistics that include
contracts, tests, Parquet and map artifacts, screenshots, reports and
checksummed receipts. They are not effective code, unique authorship, effort or
scientific impact.

## What existed at the starting SHA

- A public three-image Commons Human Review page for *Papilio demoleus*.
- Yes, No, Can’t tell, Can’t view, Skip, optional comment and reviewer alias.
- A local static judge replay with an evidence facade and BioMiner-backed
  prototype metadata.
- Three rights-attributed Commons files in the web build.
- One mutable per-item local decision object; revisiting replaced history.
- A cache that checked fresh downloads but did not fail closed at every
  inspect, prepare and open boundary.
- No generic campaign/item/sampling contract, immutable event ledger,
  reviewer-per-event identity, consensus, conflicts, adjudication, quality
  estimation, BioMiner decision export, reviewed-label v2, Supabase
  collaboration, B2 preview contract or verification-specific GPT tools.
- Human Review was not the top-level four-section Verification product.
- Baseline verification was 668 Python passes with 3 provenance failures and
  114 frontend tests.

## What the Verification goal added

### Human evidence integrity

- Yes, No and Can’t tell are gated on media that was displayed after byte,
  content-type and SHA-256 verification.
- The same fail-closed check is repeated during inspect, prepare and open.
- Cache preparation is cancellable; stale callbacks, clear failures and
  persistence failures are visible.
- Reviewer events are append-only and bind reviewer, round, image, question,
  campaign, TaxaLens and BioMiner identities. Revisions and adjudications
  preserve earlier evidence.
- Progress separates decisive, uncertain, media-failure, deferred, pending and
  conflicting work. Skip is never counted as decisive review.

### Campaign product

- Verification is a first-class section with Flickr Results, Reference Images,
  Conflicts and Quality.
- Evidence Lens and Dashboard deep-link to an exact campaign/item and return
  human evidence to the record ledger.
- Four committed campaign artifacts define 82 assignments: a three-image
  public fixture, a 49-owner Flickr audit, a 24-item GBIF/iNaturalist reference
  audit and six reviewer controls.
- The Commons packet is one campaign fixture behind generic contracts rather
  than a global product model.
- Flickr and reference workflows remain separate. Flickr results stay
  hypotheses; reference decisions stay support-only.

### Scientific quality boundary

- Consensus, second review, conflict retention and independent adjudication.
- Review, inspection and viewability coverage.
- Wilson, weighted Hájek, grouped-bootstrap, effective-sample-size, reviewer-
  agreement and reviewer-control calculations.
- Audit and active failure discovery are separate; targeted queues cannot be
  used as unweighted quality estimates.
- Release policy requires minimum independent review, required strata, a lower
  confidence bound, reference readiness and leakage checks.
- No human outcomes were fabricated. All current scientific metrics remain
  unavailable and scientific release remains blocked.

### Compatibility and collaboration

- BioMiner reference decision Parquet and Flickr reviewed-label v2 exports with
  sampling, group and dataset-split provenance.
- A repository abstraction with IndexedDB as the credential-free default.
- Optional Supabase schema, append-only database enforcement, RLS, offline
  queue and idempotent sync.
- Optional rights-gated B2 signed-preview verification and bounded LRU media
  prefetch, excluded from the public build.
- The current YOLOE + BioCLIP local runner has no fixed five-image cap. The
  historical five-image smoke remains labelled as historical evidence; review
  campaign sizes remain explicit scientific workload bounds.

### Configured model and judge experience

- Five deterministic, read-only verification evidence tools and bounded
  workflows for next action, quality change and campaign analysis.
- A credential-free stored `configured-model` replay and 28-case deterministic
  evaluation; neither is a live taxonomic or scientific evaluation.
- A verification-centered README preview, 90-second judge route, eight-slide
  presentation and 165-second video storyboard.
- One measured scripted interaction result: 20 actions manually versus 10 in
  TaxaLens, while preserving the slower assisted time and zero-human boundary.
- A repeatable fresh-context hosted verifier for public access, media hashes,
  Can’t view, Skip, export, reset, fallback and source fingerprint.

## What the Geographic Impact goal added

### Evidence architecture

- A v2 judge-bundle contract with baseline spread, provider union, Flickr
  geography, impact cells, impact summaries and country hierarchy sections;
  the stored v1 fixture remains byte-preserved and migrates fail-closed in
  memory.
- A 19,201-observation canonical baseline union that separates 4,017 GBIF-only
  observations from 15,184 iNaturalist-origin observations delivered through
  GBIF. Direct iNaturalist delta remains unavailable because no committed
  direct snapshot exists.
- Precision-aware Flickr cell evidence for 13,501 candidates, with 13,416
  geographically supported and 85 lacking usable comparison geography.
- Deterministic full-outer cell joins, global/continent/country/admin1 rollups,
  distance, temporal contribution and explicit data-deficiency states.

### Geographic product

- The operational Flickr Workload Map remains separate and unchanged in
  scientific meaning.
- A self-contained Natural Earth and MapLibre Geographic Impact Lens compares
  blue baseline occurrence evidence with amber Flickr candidate evidence.
- Global-to-continent-to-country drilldown, slicers, breadcrumbs, camera
  synchronization, exact tooltips, a color-independent legend and a sortable
  synchronized accessible table.
- Shared tested square-root bubble scaling, candidate-only cells,
  human-supported and release-ready states, country ranking and deterministic
  JSON/CSV/Parquet exports.
- A record mini-map in Evidence Lens with precision limits, nearest baseline
  context, Geographic Impact and Verification deep links.
- Explicit no-WebGL, no-WASM, unavailable-baseline, unavailable-provider and
  invalid-artifact states. Runtime map startup makes no external request.

### Human and AI evidence boundaries

- The map projects pending, positive, negative, uncertain, media-failure,
  skipped and release-ready maturity without treating local review as release.
- A representative 49-owner geographic audit, quality-snapshot readiness and a
  genuine-human usability protocol are committed, but both retain zero human
  results.
- Six deterministic geographic analyst tools, a stored credential-free
  `configured-model`/`xhigh` country explanation and 24-case safety/grounding
  evaluation.
- Candidate-only cells remain potential coverage contribution. Human-supported
  and release-ready contribution remain zero until genuine review and release
  gates pass.

### Competition and release evidence

- Real Geographic Impact screenshots, a global-to-country GIF, README preview,
  90-second judge route, presentation deck, 32-second video hero plan and
  Devpost wording.
- 914 Python tests and 544 frontend tests pass at final reporting; Chromium,
  Firefox and WebKit browser coverage, 20 visual checks, dedicated performance
  checks and the no-external-map network guard pass.
- The hosted verifier now exercises global → Europe → Sweden, a selected cell,
  record mini-map, Verification deep link and scientifically blocked export in
  a fresh credential-free browser context.

## What BioMiner contributed

BioMiner remains the upstream research engine and authority for reference
resolution, target-aware scoring contracts and scientific evaluation. TaxaLens
uses exact, allowlisted, checksum-verified committed artifacts and narrow
compatibility contracts. No broad BioMiner source tree, model weights, image
collection, database or cache was copied for this goal.

The current 81-of-81 BioMiner receipt confirms only prototype support-role
suitability. It does not contribute 81 independent taxonomic reviews. The
newer BioMiner checkout did not replace the immutable `74a7d648…` evidence
lineage.

## What is still not delivered

- No retained human Flickr, reference or reviewer-control outcomes.
- No classification accuracy, precision, recall, PR-AUC, calibration,
  agreement or release-quality result.
- No verified occurrence or independently verified reference bank.
- No human productivity or time-savings study.
- No genuine Geographic Impact usability participant or timing result.
- No human-supported or release-ready additional geographic cell.
- No direct iNaturalist delta or provider comparison beyond iNaturalist-origin
  rows already delivered through GBIF.
- No live Supabase project, private B2 campaign or production collaboration
  credential.
- No live Configured model quality evaluation or model-authorised scientific decision.

The exact current tests, hosted receipt, rights state, review counts and blocked
claims are in
[`taxalens_verification_workflow_report.md`](../docs/reports/taxalens_verification_workflow_report.md)
and
[`taxalens_geographic_impact_report.md`](../docs/reports/taxalens_geographic_impact_report.md).
The separate AI code-provenance report retains its own dated source snapshot
and should not be silently treated as this Git-range delta.
