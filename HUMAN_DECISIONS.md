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

## Change control

Changes to these decisions require explicit human approval and corresponding
updates to architecture, contracts, tests, provenance, and product language.
