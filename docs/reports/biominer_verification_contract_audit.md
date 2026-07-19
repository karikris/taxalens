# BioMiner Verification contract audit

## Audit identity and source discipline

- Audit date: 2026-07-16 (Australia/Sydney)
- TaxaLens task starting commit:
  `303a31bf0aabff1efe33452bd4600adb102e29a9`
- BioMiner committed `main` inspected:
  `94fa1f634ee3c63917c05d78181dd3cf9ceff940`
- Existing TaxaLens judge-bundle BioMiner artifact pin:
  `74a7d648a562efa744e6502ef504a23b63b4e02f`
- BioMiner source licence: MIT
- BioMiner working-tree files used as source: none
- BioMiner files modified: none

All conclusions below come from committed Git objects at `94fa1f6`. The
untracked BioMiner workspace files are outside the integration boundary.
TaxaLens must continue to consume a fixed committed artifact, versioned schema,
thin adapter, or stable BioMiner command rather than importing a working-tree
module.

## Authoritative committed contracts

### Reference queue and source binding

BioMiner defines the reference-review queue in:

- `src/biominer/references/schemas.py`
- `src/biominer/references/review.py`
- `docs/schemas/target_aware_few_shot_contracts.md`

`reference_review_queue.parquet` is a deterministic materialized request
queue, not a decision ledger. Its key identity and review fields include:

- `review_request_id`;
- `reference_media_id`;
- `reference_observation_id`;
- `canonical_reference_media_id`;
- accepted taxon key and scientific name;
- durable preview URI and media-object fingerprint;
- duplicate group;
- source and provider media ID;
- provider verification status;
- creator, rights holder, media licence, licence URI, licence-policy state, and
  attribution;
- proposed life stage, visual domain, and view;
- review reason and priority;
- required reviewer count;
- workflow status;
- reference-bank version;
- immutable input fingerprint.

`reference_review_queue_provenance.parquet` binds each request to:

- source-leaf fingerprints;
- source-binding fingerprint;
- queue-semantics fingerprint;
- complete queue-row fingerprint;
- input fingerprint.

BioMiner rejects changed taxonomy, source identity, object identity, licence,
source snapshot, duplicate policy, proposal, or quorum before applying retained
review evidence. Operational changes may change the packet fingerprint without
silently transferring a scientific decision to a different media identity.

### Decision import and append-only ledger

BioMiner publishes a typed
`reference_review_decision_template.parquet` and accepts the exact physical
schema `reference-review-decision-import-v1.0.0`.

The imported fields are:

- request and media IDs;
- reviewer-local review round;
- canonical reviewer ID;
- UTC review time;
- tri-state target-identity judgment;
- verification status;
- life stage;
- visual domain;
- view;
- categorical review confidence;
- notes;
- exclusion reason;
- optional conflict pointer.

The authoritative `reference_review_decisions.parquet` adds:

- deterministic `review_decision_id`;
- canonical `decision_source_hash`.

The ledger is append-only. A correction is a later contiguous review round for
the same reviewer. The effective projection uses that reviewer’s latest round
but retains every prior row. Re-delivery of the same source decision is
idempotent; conflicting reuse of an ID or source hash is rejected.

Reviewer identity is canonical lowercase opaque ASCII. BioMiner treats it as
an asserted ledger identity and requires production authentication outside the
Parquet command boundary.

### Consensus and conflict projection

`resolve_reference_review_statuses` deterministically produces:

- `reference_review_outcomes.parquet`;
- `reference_review_conflicts.parquet`;
- `verified_reference_media.parquet`;
- `excluded_reference_media.parquet`.

The outcome projection records:

- effective decision and reviewer IDs;
- decisive reviewer count and required reviewer count;
- resolved scientific dimensions;
- second-review requirement;
- support eligibility and blocker reasons;
- queue and decision-ledger fingerprints.

Scientific disagreement is evaluated across verification status, target
identity, life stage, visual domain, and view. Notes or confidence differences
alone do not create a scientific conflict.

An uncertain judgment requires a distinct later decisive reviewer. A simple
majority does not erase a dissenting effective decision. Open and resolved
conflict groups remain in history.

### Support eligibility

Reference support remains blocked unless all relevant conditions pass.
BioMiner’s current blockers include:

- incomplete or unresolved review;
- identity not verified;
- visual domain not production-support eligible;
- noncanonical duplicate media;
- unresolved taxonomy;
- disallowed licence;
- missing attribution;
- pending duplicate resolution.

TaxaLens may display these reasons and prepare handoffs, but it must not
independently promote a reference into a BioMiner support bank.

### Review history

BioMiner publishes immutable review packets and uses a separate lock-protected
history-head JSON as a compare-and-swap pointer. Every continuation validates
the authoritative parent report, queue, provenance, complete decision ledger,
artifact byte hashes, revision, and history ID before advancing.

TaxaLens local replay does not need to reproduce this filesystem publication
engine. A future production repository must preserve equivalent append-only,
idempotent, source-bound semantics before a BioMiner import is authorized.

## Reviewed-label v2

`src/biominer/evaluation/labels.py` defines
`reviewed-labels-v2`. It keeps the v1 source, Flickr, detection, taxonomy,
reviewer, timestamp, confidence, and note fields and adds:

- `target_present`;
- label certainty;
- life stage;
- visual domain;
- view;
- route;
- geographic cluster;
- source query tier and term;
- duplicate group;
- observer/owner group;
- dataset split;
- second-review status;
- ambiguity reason;
- unsuitable-for-species-identification flag.

The validator rejects unsupported schemas, invalid closed-vocabulary values,
route/dimension conflicts, incomplete butterfly taxonomy, conflicting
object-level duplicate labels, and missing review metadata. Raw BioCLIP or
search metadata cannot fill these human-review fields.

Reference-bank decisions and Flickr reviewed-label v2 are separate contracts.
A reference decision must never be reinterpreted as a Flickr final-test label.

## Evaluation sampling and grouping

`src/biominer/evaluation/sampling.py` defines a deterministic, unlabelled
Flickr sampling register. It explicitly forbids ground-truth columns such as
`target_present`, `reviewed_label`, and accepted identity.

The register preserves:

- source and Flickr identity;
- source-record hash and image URL;
- owner identity and source-scoped owner group;
- time and geography strata;
- query tiers, terms, fields, definitions, and hit provenance;
- metadata category and life stage;
- YOLOE route and subject-area bands;
- target-reference score and competitor-margin bands;
- strongest competitor;
- visual-input disagreement;
- deterministic sampling hash and rank.

BioMiner’s leakage, split, holdout, and uncertainty modules separately enforce
duplicate, perceptual-duplicate, owner, observation, provider-mirror, and
other group boundaries. TaxaLens must retain these fields in campaigns and
exports. One image, duplicate, owner burst, or observation cluster must not be
counted as several independent evaluation units.

The current sampling frame is a deterministic candidate register, not by
itself a probability-sampling design with inclusion probabilities. TaxaLens
must not infer population precision from its rank or from a failure-discovery
queue. Any audit campaign that supports a weighted quality estimate must add a
declared sampling plan, selection probability, and group-aware analysis while
remaining compatible with BioMiner evaluation grouping.

## Duplicate handling

BioMiner distinguishes:

- exact content identity;
- perceptual similarity;
- same observation;
- provider mirror;
- metadata conflict;
- canonical and noncanonical media;
- unresolved or conflicting duplicate groups.

Unresolved or conflicting group members remain separate review requests.
Human evidence is not transferred across a provisional duplicate link.
Canonical selection and duplicate eligibility remain BioMiner scientific
authority.

## TaxaLens adaptation boundary

TaxaLens will adapt:

- committed campaign metadata from
  `reference_review_queue.parquet`;
- request-to-source bindings from
  `reference_review_queue_provenance.parquet`;
- the committed decision-import template;
- provider, observation, duplicate, route, and rights metadata;
- reviewed-label v2 field names and closed-vocabulary semantics;
- committed sampling and group identities;
- BioMiner outcome, conflict, and blocker vocabulary for display and handoff
  validation.

The adapter will map those artifacts into TaxaLens-native generic:

- `VerificationCampaign`;
- `VerificationItem`;
- append-only `VerificationEvent`;
- consensus/conflict projection;
- export receipt.

Every adapted item must retain its exact BioMiner source commit, schema,
artifact fingerprint, request ID, media ID, and source-binding fingerprint.

## Stable BioMiner invocation boundary

Where committed fixtures are available, TaxaLens will read and validate them
locally. Where validation must use BioMiner behavior, TaxaLens may invoke a
stable committed validator or CLI through a thin offline adapter, including:

- reference queue and provenance validation;
- decision-import validation;
- reviewed-label v2 validation;
- dataset grouping and leakage validation.

The public browser replay will not execute BioMiner Python, mutate BioMiner,
or claim an import occurred. Production import remains an explicit,
authenticated operation outside the static judge replay.

## TaxaLens exports

TaxaLens will prepare, without automatically importing:

1. `reference_review_decision_import.parquet`, matching the exact BioMiner
   import schema and stale-binding rules;
2. Flickr `reviewed-labels-v2` Parquet, preserving grouping, split, sampling,
   blind-review, and reviewer provenance;
3. deterministic manifests and JSON receipts binding campaign, item, event
   ledger, source artifacts, TaxaLens commit, and BioMiner commit.

The public UI must say:

> Prepared for BioMiner import; not imported in the public replay.

## Code TaxaLens will not copy

TaxaLens will not copy:

- the 3,640-line `src/biominer/references/review.py` workflow;
- Polars schema and validation implementations from
  `src/biominer/references/schemas.py`;
- BioMiner queue construction, deduplication, licensing, selection, readiness,
  or support-bank code;
- review-packet filesystem publication and history-head implementation;
- evaluation sampling, split, leakage, calibration, or metrics engines;
- BioMiner CLI orchestration;
- GBIF or iNaturalist acquisition adapters;
- production image collections.

TaxaLens needs a product-facing anti-corruption layer and matching export
contracts, not a second scientific engine.

## Authority retained by BioMiner

BioMiner remains authoritative for:

- reference acquisition and source reconciliation;
- duplicate and canonical-media resolution;
- queue construction and source binding;
- reference decision import validation;
- reference consensus/conflict publication;
- reference support eligibility and readiness;
- reviewed-label v2 scientific validation;
- dataset splits and leakage-safe groups;
- calibration and final scientific evaluation;
- scientific release gates.

TaxaLens remains authoritative for:

- researcher-facing campaign selection and media inspection;
- local and collaborative review event capture;
- accessibility and browser persistence;
- current-state, consensus, conflict, and quality presentation;
- credential-free replay;
- deterministic handoff preparation;
- evidence-ledger and Configured model workflow integration.

TaxaLens may calculate a local preview projection for immediate user feedback,
but only BioMiner’s validated imported artifacts authorize reference-bank
support or scientific evaluation.

## Integration risks to test fail closed

- stale request or media binding;
- changed source-leaf or queue-semantics fingerprint;
- changed media object fingerprint;
- missing or incompatible rights metadata;
- duplicate group with conflicting taxon provenance;
- reviewer identity outside the BioMiner canonical form;
- non-contiguous reviewer-local rounds;
- conflict pointer to the wrong request, media, actor, or time;
- decisive event missing required structured fields;
- reference event exported as Flickr label or vice versa;
- active-learning/failure-discovery sample used as an unweighted audit;
- group leakage across support, selection, calibration, or final test.
