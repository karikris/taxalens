# TaxaLens Build Week delta

This disclosure separates the pre-existing TaxaLens/BioMiner research prototype
from the Verification product work delivered in the current goal. It is a Git
change ledger, not an authorship estimate or scientific-result claim.

## Comparison boundary

| Boundary | Commit |
| --- | --- |
| Pre-existing TaxaLens product at goal start | `d728618fc2506054c71e726f943a845cdd2f61eb` |
| Completed Verification implementation | `94158393c9d3886143b432ecc4fbc5f783829c3b` |
| Completion report measurement endpoint | `30a4994` |
| Current BioMiner implementation context | `94fa1f634ee3c63917c05d78181dd3cf9ceff940` |
| Immutable BioMiner judge-evidence pin | `74a7d648a562efa744e6502ef504a23b63b4e02f` |

The non-self-referential Git range from `d728618…` through `30a4994` contains
133 commits and changes 366 files: 76,141 physical text-line insertions, 2,409
physical text-line deletions, and 21 binary-file changes. These are Git diff
statistics, not effective lines of code, unique authored lines or a model
attribution. They include tests, schemas, fixtures, campaign packets, reports
and generated/checksummed artifacts.

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

## What this goal added

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

### GPT-5.6 and judge experience

- Five deterministic, read-only verification evidence tools and bounded
  workflows for next action, quality change and campaign analysis.
- A credential-free stored `gpt-5.6-sol` replay and 28-case deterministic
  evaluation; neither is a live taxonomic or scientific evaluation.
- A verification-centered README preview, 90-second judge route, eight-slide
  presentation and 165-second video storyboard.
- One measured scripted interaction result: 20 actions manually versus 10 in
  TaxaLens, while preserving the slower assisted time and zero-human boundary.
- A repeatable fresh-context hosted verifier for public access, media hashes,
  Can’t view, Skip, export, reset, fallback and source fingerprint.

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
- No live Supabase project, private B2 campaign or production collaboration
  credential.
- No live GPT-5.6 quality evaluation or model-authorised scientific decision.

The exact current tests, hosted receipt, rights state, review counts and blocked
claims are in
[`taxalens_verification_workflow_report.md`](../docs/reports/taxalens_verification_workflow_report.md).
The separate AI code-provenance report retains its own dated source snapshot
and should not be silently treated as this Git-range delta.
