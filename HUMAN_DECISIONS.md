# Human decisions

This register preserves product and scientific decisions that govern TaxaLens.
They are constraints on implementation and presentation, not model-generated
biological conclusions.

## Evidence interpretation

### Search results are hypotheses

Retrieval explains why a record entered the pipeline. A query match is not a
verified occurrence or species identification, regardless of the query's
taxonomic rank.

### The target is never pruned by hierarchy

Target-aware scoring always retains the target species and the complete
configured regional candidate union. Higher-rank evidence is diagnostic and
must not remove species candidates.

### Geography is a soft prior

Geographic evidence may select competitors, support images, features, and
review priority. It must not certify a species, force the target score to zero,
or treat missing evidence as biological absence.

### Comments expand candidates rather than vote

Every valid registry-resolved species mention may expand a versioned candidate
set. Comments do not overwrite visual evidence, establish truth, or remove the
original target.

### Abstention is required

Insufficient visual detail, reference coverage, geographic context, or
out-of-distribution evidence must be allowed to produce an explicit abstention
or review state. TaxaLens does not force every record into a species label.

## Visual evidence

### Target-aware production uses the full image canvas

Permitted inputs are full-frame variants. Detector crops must not silently
replace them. Small subjects lower confidence or route to review rather than
triggering manufactured visual detail through tighter crops.

### YOLOE is a gate and router

YOLOE separates visual domains and routes records for downstream processing. It
does not make the production species decision.

### BioCLIP remains frozen

BioCLIP embeddings are reusable visual evidence. Raw similarities, distances,
and margins are not probabilities and must remain visually separate from
calibrated outputs.

### Biological and visual domains remain separate

Adult field images, pinned specimens, larvae, pupae, eggs, and visual artifacts
must not share one prototype or decision policy.

## Reference and compute policy

### Only verified references support production decisions

Unverified, conflicted, or licence-blocked references may remain visible for
review and provenance but do not enter production support.

### Expensive visual work is reused

Each unique media asset is downloaded, hashed, decoded, detected, and embedded
only as required by its fingerprints. Candidate expansion reuses cached
full-frame embeddings.

### One BioCLIP worker per accelerator is the default

TaxaLens assumes one persistent model process per accelerator unless measured
evidence supports a different configuration.

## Retrieval and architecture

### Logical and physical Flickr queries remain separate

Physical request deduplication must preserve every logical query association so
the Evidence Lens can explain all reasons a record was retrieved.

### TaxaLens is the product layer

BioMiner remains the scientific research engine. TaxaLens owns replay,
presentation, observability, researcher interaction, and stable adapters to
committed BioMiner artifacts; it does not duplicate unfinished engine logic.

### Only committed BioMiner contracts may be consumed

Every imported or adapted component is pinned to a full committed SHA. Staged,
untracked, or otherwise uncommitted upstream work is excluded until explicitly
re-evaluated and approved.

### BioMiner integration is artifact-first

Broad BioMiner module copying is frozen. TaxaLens first consumes a committed
artifact, then a versioned schema, a thin adapter, a stable BioMiner command, or
a small shared package. Copying source requires an explicit finding that every
earlier option is unsuitable. Existing copied modules remain historical,
provenance-bound compatibility contracts rather than a migration template.

### Product consumers use a TaxaLens facade

UI and analyst code consume stable TaxaLens product contracts with provenance
and explicit availability. They do not import BioMiner implementation modules
or reimplement biological policy. Missing, incompatible, blocked, or unreviewed
evidence stays visibly unavailable.

### Verification is campaign-driven

Human verification is configured through fingerprinted campaigns, items,
questions, sampling plans, and disclosure policies. Flickr-result review,
reference-image review, conflict adjudication, and quality control remain
distinct campaign kinds even when they share product infrastructure.

Yes, No, and Can’t tell require checksum-verified media to have been displayed.
Can’t view records a media failure. Skip records deferred work. Neither Can’t
view nor Skip is a positive or negative taxonomic decision, and Skip does not
count as reviewed coverage.

### TaxaLens is the review and collaboration interface

TaxaLens owns campaign navigation, reviewer interaction, append-only review
events, local and cloud repository adapters, current-state projections,
conflict presentation, and compatible exports. BioMiner remains authoritative
for reference resolution, support eligibility, reviewed-label validation,
sampling validation, calibration, final evaluation, and scientific release.

Review exports from the public replay are prepared for BioMiner import but are
not imported upstream by the replay.

### Prototype-role suitability is not taxonomic verification

A human confirmation that a provider-supported image is suitable for an
assigned prototype role does not establish that the depicted organism has been
independently taxonomically verified. Product copy, evidence contracts, exports,
and quality panels must keep those claims separate.

### Statistical quality requires representative independent evidence

Review count and coverage are not population-quality estimates. Statistical
quality may be estimated only from a declared probability sample with valid
inclusion probabilities or weights, sufficient independent review evidence,
configured duplicate and observation grouping, leakage-safe use, and a named
interval method with its assumptions.

Failure-discovery campaigns may prioritize likely errors, but their unweighted
outcomes must not be reported as population accuracy or precision. More reviews
may tighten uncertainty only when the additional evidence remains
representative, sufficiently independent, and correctly weighted.

### Phase 14 metadata remains candidate evidence

Geographic workload, search hits, source-media candidates, competitor plans,
negative candidates, and shortfall reports describe research workload. They do
not establish occurrences, support images, identities, calibration, or model
success. Candidate/reference product contracts record candidate semantics,
verification status, human-review requirement, and whether a scientific claim
is allowed.

### Prototype authorization is explicit and narrow

The committed Phase 14/15 handoff may be integrated only in an unmistakable
`explicit_prototype` mode after all fourteen fail-closed entry gates pass.
`GO_PROTOTYPE_ONLY` does not authorize a production-default change, scientific
release, public display of the reference images, calibrated probability,
accuracy claim, or scientific conclusion. A request for any broader mode is
`NO_GO`.

Provider-supported prototype rows are not independently human-verified labels.
The selected B13 raw-margin policy and staged inference distributions are
operational retrieval evidence only; they are not per-record hero evidence,
classification accuracy, biological occurrence, or prevalence.

### Legacy family-first output is diagnostic only

Family-first filtering and reranking may be shown as a labelled historical
baseline or engineering diagnostic. It cannot drive the TaxaLens target-aware
species decision, recover unavailable evidence, prune the target, or replace
complete configured candidate scoring.

### Scientific claims remain blocked until their gates pass

The Phase 14 prototype may expose its selected B13 retrieval policy and
operational staged-inference evidence, but no independently reviewed Papilio
classification, production reference bank, calibrated probability, precision,
recall, accuracy, or final scientific evaluation is available until
attributable human review, rights checks, immutable leakage-safe splits,
calibration selection, and final-test publication are committed and
independently verified.

### Geographic workload and geographic impact remain separate

Flickr Workload Map is an operational view of candidate acquisition clusters,
outliers, dispersion, and processing work. It does not compare occurrence
evidence or calculate scientific contribution.

Geographic Impact Lens is a separate artifact-first comparison of one
deduplicated baseline snapshot with one precision-aware Flickr candidate
snapshot. Every read is scoped by project, run, accepted taxon, baseline
snapshot, Flickr snapshot, grid, and resolution. Missing or incompatible
artifacts remain unavailable.

Zero baseline rows means absent from the selected baseline snapshot. It is not
proof of biological absence. Product copy uses data-deficient baseline and
potential coverage contribution where appropriate.

### Provider double counting is prohibited

GBIF rows and direct iNaturalist rows must not be added independently because
GBIF can deliver iNaturalist-origin observations. A canonical provider union
must retain every provider relationship, remove only deterministic duplicates,
and keep unresolved duplicate groups explicit. When no direct iNaturalist
occurrence snapshot exists, its delta remains unavailable and no display-only
fetch is permitted.

### Geographic review and release are distinct

An unreviewed Flickr result is candidate evidence. A decisive target-positive
human outcome can make it human-supported evidence. It becomes a release-ready
occurrence candidate only after the configured coordinate, duplicate, quality,
provenance, consensus, and occurrence-release gates pass.

Skip and Can't view do not support spatial or temporal contribution. Can't
tell and unresolved conflict remain uncertain. Failure-discovery reviews may
show reviewed examples but do not authorize unweighted population inference.
Every aggregate reviewed-contribution claim is bound to a valid
`QualitySnapshot` and its sampling disclosures.

### Geographic presentation remains globally framed

Global is the canonical public, judge, capture, hosted-check, and stored-agent
scope. TaxaLens does not hard-code a named country, ISO country code, candidate
cell, or candidate record as the representative project geography. Doing so
would give an unreviewed search result narrative weight that its evidence does
not support.

Country and regional drilldown remain optional researcher controls. Tests
derive those scopes from the verified hierarchy or use clearly synthetic
contract identities. A real named place may be displayed when selected from
artifact-backed evidence, but it remains context and does not establish an
occurrence or biological range.

### Reviewed-label contracts are not retained outcomes

Current BioMiner `main` requires the `reviewed-labels-v2` contract and has
removed legacy v1 migration. Its committed reviewed-label rows are explicitly
synthetic test fixtures. Contract support, schema validation, and prototype-role
suitability do not establish retained human taxonomic outcomes in the TaxaLens
campaigns. The public campaign state remains zero until attributable review
events are committed or imported through the declared workflow.

## Change control

Changes to these decisions require explicit human approval and corresponding
updates to architecture, contracts, tests, provenance, and product language.
