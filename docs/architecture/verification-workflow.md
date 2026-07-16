# Verification workflow architecture

Status: accepted

Decision date: 2026-07-16

Scope: TaxaLens Verification product and its BioMiner integration boundary

## Context

TaxaLens currently exposes a credential-free three-image Human Review replay.
That replay proves checksum-bound media preparation and local decisions, but it
does not yet model campaigns, immutable review history, independent reviewers,
consensus, conflicts, representative sampling, or scientific quality
estimation.

Verification must become a first-class research workflow without moving
BioMiner's scientific authority into the browser. Search results and
provider-supplied identities remain candidate evidence until the configured
human and scientific gates pass.

## Decision

TaxaLens will expose **Verification** as a top-level product section with four
separate workspaces:

1. **Flickr Results** — blind audit campaigns and explicitly labelled
   failure-discovery campaigns for candidate Flickr records.
2. **Reference Images** — GBIF and iNaturalist identity, route, life-stage,
   visual-domain, view, quality, duplicate, and exclusion review.
3. **Conflicts** — unresolved reviewer disagreements and append-only
   adjudication.
4. **Quality** — campaign coverage, viewability, consensus, reviewer
   reliability, sampling-aware estimates, uncertainty, and release gates.

The current Commons three-image packet will remain available as a public,
credential-free judge campaign. It will use the same campaign, item, event,
repository, consensus, and quality contracts as every other campaign. It will
not remain a product-global Papilio-specific special case. Its asset identity,
rights metadata, campaign settings, and item records are declared once in the
canonical
[`Papilio demoleus` verification manifest](../../demo/source/verification/papilio-demoleus-commons.campaign.json);
the browser packet and judge-bundle artifacts are projections of that file.

## Responsibility boundary

| Concern | TaxaLens | BioMiner |
| --- | --- | --- |
| Campaign navigation and reviewer UX | Authority | No |
| Local replay and offline review repository | Authority | No |
| Production collaboration adapter | Authority | No |
| Media preparation and checksum verification | Authority for displayed review media | Supplies source fingerprints and rights metadata |
| Append-only reviewer events | Captures, stores, projects, and exports | Validates compatible imports |
| Reference queue generation and source resolution | Adapts committed artifacts | Scientific authority |
| Reference support eligibility | Displays authoritative result | Scientific authority |
| Flickr audit/failure-discovery queue presentation | Authority | Supplies committed inputs and validation contracts |
| Reviewed-label and reference-decision exports | Produces compatible handoffs | Import and scientific-validation authority |
| Consensus and conflict projection | Deterministic product projection | May validate or consume the projection |
| Statistical evaluation and release authorization | Displays committed results and deterministic snapshots | Scientific authority |
| Model calibration and final-test evaluation | No | Scientific authority |

TaxaLens will use ports and thin adapters at this boundary. Broad BioMiner
source copying remains frozen. The preferred integration order remains:
committed artifact, versioned schema, thin adapter, stable BioMiner command,
small shared package, and copied source only after an explicit finding that all
earlier options are unsuitable.

## Campaign and review lifecycle

The product lifecycle is:

1. Load a fingerprinted campaign and its items.
2. Select an item and prepare only permitted media.
3. Validate byte count, SHA-256, and media type before display.
4. Inspect the source media.
5. Record Yes, No, Can't tell, Can't view, or Skip, plus optional structured
   corrections and comment.
6. Append an immutable event bound to the reviewer, media, question, campaign,
   TaxaLens revision, and BioMiner revision.
7. Project the current decision from the event ledger.
8. Recalculate consensus or expose an unresolved conflict.
9. At declared milestones, create a fingerprinted quality snapshot when the
   campaign sampling design permits it.
10. Return the human evidence and event identifiers to Evidence Lens.
11. Export a deterministic BioMiner-compatible handoff without claiming that
    the public replay imported it upstream.

Yes, No, and Can't tell are scientific inspection outcomes and require
checksum-verified media to have been displayed. Can't view and Skip may be
recorded without display. Can't tell is neither positive nor negative. Can't
view is a media failure. Skip is deferred work and does not count as reviewed
coverage.

## Local replay and production collaboration

The public replay is a deterministic, credential-free local mode:

- static, public-rights media only;
- bounded browser caching;
- local event persistence;
- deterministic local exports;
- resettable state;
- no write to BioMiner, Supabase, B2, or another remote service;
- export copy: “Prepared for BioMiner import; not imported in the public
  replay.”

Production collaboration will use the same domain ports with different
adapters:

- IndexedDB for offline campaigns, items, events, projections, and sync state;
- Supabase for shared append-only events, assignments, consensus, and quality
  snapshots;
- private B2/S3-compatible signed previews for rights-restricted media;
- idempotent sync by event ID and fail-closed source fingerprint validation.

Offline and server repositories must pass the same repository contract tests.
Changing an adapter must not change campaign, event, consensus, or quality
semantics.

## Blind and unblinded review

A campaign declares which context is visible before a decision.

Blind Flickr audit review hides model-influencing context until the reviewer
appends an event, including:

- BioCLIP result, margin, decision, and strongest competitor;
- Flickr comments;
- source search term and query trust tier;
- provider-supplied target identity.

An unblinded campaign may reveal configured context for reference review,
failure discovery, adjudication, or operational diagnosis. The campaign
manifest records the disclosure policy and the question fingerprint. A review
event is invalid if it claims a blind protocol but was produced from an
unblinded question configuration.

## Audit samples and failure-discovery samples

The sampling purpose is immutable campaign provenance.

An **audit sample** is selected using a declared probability design before
review. It preserves inclusion probabilities, strata, and configured
independence groups. Only a valid audit sample may support population-quality
estimates, with its estimator, interval method, confidence level, weights,
effective sample size, represented strata, clustering assumptions, and missing
strata reported.

A **failure-discovery sample** is deliberately enriched for low margins,
disagreement, geographic anomalies, comment conflicts, small subjects,
reference shortfalls, or unusual competitors. It is useful for finding and
repairing errors. It must not be used unweighted to estimate population
accuracy or precision.

Exact duplicates, perceptual duplicates, burst observations, owner groups, and
configured geographic or observation clusters must not inflate effective
sample size.

## Append-only review evidence

Review events are the durable scientific record. There is no update or delete
operation in the normal reviewer interface.

If a reviewer changes a decision, TaxaLens appends a new event with
`supersedesEventId`; the earlier event remains exportable and visible in
history. Reviewer identity is copied into each event at creation and is never
rewritten when the active reviewer changes.

Current decisions, progress, conflicts, consensus, and quality are projections
over immutable events. Cached projections are disposable and reproducible.
Storage adapters use event IDs for idempotency and expected ledger revisions
for conflict detection.

## Consensus and adjudication

Consensus is a deterministic projection over the latest non-superseded event
from each effective independent reviewer. It distinguishes:

- complete agreement;
- unresolved disagreement;
- uncertain-only evidence;
- media failure;
- deferred work;
- adjudicated outcome.

Repeated events from one reviewer do not create additional independent votes.
Can’t view, Skip, and Can't tell are not converted into positive or negative
votes. Campaign requirements determine required reviews, second-review rules,
and whether an outcome may become support-eligible or final-test-eligible.

Adjudication appends a new event that cites the conflicting event IDs and the
fields resolved. It never edits or deletes prior reviews. A deterministic
consensus projection must be independent of event input order once ledger
ordering and supersession are validated.

## Quality snapshots

A quality snapshot is an immutable, fingerprinted projection bound to:

- campaign and sampling-plan fingerprints;
- event-ledger head or complete event fingerprint;
- consensus projection version;
- counts and coverage states;
- estimator and interval method;
- effective sample size and represented strata;
- agreement and conflict metrics when valid;
- release-policy version and gate results;
- TaxaLens and BioMiner source revisions.

Coverage and quality are separate. More reviews can increase inspected or
decisive coverage. They tighten uncertainty only when the additional reviews
are sufficiently independent, representative, correctly weighted, and
leakage-safe under the declared design.

Snapshots are produced at declared review milestones rather than by silently
applying a fixed-sample interval after every click. If sampling assumptions,
reviewer overlap, required strata, or decisive sample size are insufficient,
the metric remains explicitly unavailable and no interval is drawn.

## Consequences

- The review code will be split into domain, repository, media, export, and UI
  boundaries.
- Scientific review evidence will move from mutable localStorage session maps
  to an append-only repository contract, with one-time legacy migration.
- Flickr and reference campaigns share infrastructure but never share
  scientific decision semantics or leakage groups.
- Evidence Lens and Dashboard will deep-link to campaign items and consume
  current projections rather than importing review implementation details.
- Public replay remains useful without credentials while production
  collaboration can add Supabase and private media adapters.
- The product will report unavailable metrics and blocked release gates
  explicitly rather than deriving claims from clicks, provider labels, raw
  similarities, or failure-discovery queues.

## Rejected alternatives

- Keeping one global three-image packet and adding more conditional UI.
- Overwriting one decision per item and treating the latest localStorage value
  as the audit record.
- Copying BioMiner’s reference-review and evaluation engines into TaxaLens.
- Treating provider-supported or prototype-role-suitable images as
  independently taxonomically verified.
- Showing model decisions before blind Flickr review.
- Using majority vote without reviewer independence, supersession, uncertain
  outcomes, conflict state, or adjudication provenance.
- Treating review count, failure-discovery yield, or raw BioCLIP margin as a
  population-quality estimate.
