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

## Change control

Changes to these decisions require explicit human approval and corresponding
updates to architecture, contracts, tests, provenance, and product language.
