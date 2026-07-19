# Scientific and product rules

## Product boundary

TaxaLens is not BioMiner.

BioMiner owns:

- registry and source acquisition;
- geographic and reference planning;
- YOLOE/BioCLIP execution;
- model training/calibration;
- scientific evaluation and release authorization.

TaxaLens owns:

- product facade;
- deterministic replay;
- evidence presentation and lineage;
- browser analytics;
- Verification UX and repository adapters;
- Geographic Impact UX;
- exports;
- Configured model research tools;
- judge experience.

Integration order:

```text
committed artifact
→ versioned schema
→ thin adapter
→ stable BioMiner command
→ small shared package
→ copied source only after explicit rejection of all earlier options
```

Web and analyst code must not import `biominer_*` implementation modules.

## Identity and provenance

- Stable IDs and versioned contracts identify evidence.
- Display labels are not identifiers.
- Semantic fingerprints and physical SHA-256 checksums are distinct.
- Source repository, commit, artifact path, schema, and rights travel with
  imported evidence.
- Historical copied replay modules remain provenance-bound compatibility code,
  not a template for more copying.
- Missing, incompatible, blocked, or unreviewed evidence is explicit.

## Retrieval and target semantics

- A query match explains discovery, not identity.
- Preserve every logical query association after physical deduplication.
- Comments may add registry-resolved candidates; they do not vote a species
  into truth.
- Target-aware scoring retains the target and configured candidate union.
- Higher-rank evidence is diagnostic or derived; it cannot prune the target.
- Legacy family-first output is labelled historical diagnostic only.

## Visual evidence

- YOLOE is a route/domain/quality source, not a species classifier.
- Target-aware product evidence uses full-frame raw, focused, masked, or
  multi-object inputs under the pinned contract.
- Do not silently substitute spatial crops.
- Small subjects create quality/review evidence, not manufactured detail.
- Adult, larval, pupal, specimen, and artifact domains stay separate.
- BioCLIP remains a frozen visual encoder under the current contract.
- Raw scores remain distinct from calibrated probabilities.

## References and prototype evidence

The current public prototype has provider-supported reference evidence and a
prototype-role suitability receipt. That does not establish:

- independent taxonomic verification;
- production reference readiness;
- accuracy;
- calibration;
- public-display rights;
- scientific release.

Current `HUMAN_DECISIONS.md` requires verified references for production
decisions. BioMiner's newer adaptive fast-start policy must not silently alter
TaxaLens's pinned prototype. A dedicated migration must define:

- the exact BioMiner source SHA;
- admission semantics;
- product vocabulary;
- rights;
- compatibility;
- updated tests and human decisions.

## Human review

Review is campaign-driven and append-only.

- Yes, No, and Can't tell require checksum-verified media display.
- Can't tell is uncertain.
- Can't view is media failure.
- Skip is deferred.
- Can't view and Skip do not count as reviewed coverage.
- One reviewer contributes one effective latest non-superseded event per item.
- Conflicts and adjudication preserve all prior events.
- Public replay exports are prepared for BioMiner import; they are not imported
  upstream by the replay.

## Statistical quality

Coverage and quality are different.

Quality estimates require:

- declared sampling purpose;
- valid inclusion probabilities or weights;
- independent grouping;
- leakage-safe use;
- sufficient decisive evidence;
- named estimator and interval method;
- represented strata;
- fingerprinted event and sampling evidence.

Failure-discovery samples may find errors but do not support unweighted
population-quality claims.

Zero human outcomes means:

```text
review coverage may be assigned but no decisive evidence exists
quality interval unavailable
human-supported geographic contribution zero
release-ready geographic contribution zero
```

## Geography and occurrence contribution

- Geography is a soft structured evidence layer.
- No baseline evidence means absent from the selected snapshot or
  data-deficient, not biologically absent.
- A candidate-only cell is potential coverage contribution.
- A reviewed target-positive cell may become human-supported.
- Release-ready requires record-level occurrence-release decisions and every
  configured gate.
- Range-edge distance is a cell-resolution approximation, not a biological
  range boundary.
- A newer Flickr date is temporal candidate evidence, not proof of change.
- Skip, Can't view, non-target, and uncertain outcomes never add target
  contribution.

## Provider union

GBIF can deliver iNaturalist-origin observations.

Do not calculate:

```text
all GBIF + all direct iNaturalist
```

Use the canonical provider union:

- GBIF-only;
- iNaturalist-origin through GBIF;
- direct iNaturalist delta when committed;
- exact duplicates removed;
- unresolved duplicate groups explicit.

When no direct iNaturalist snapshot exists, the delta is unavailable—not zero.

## Rights and public display

- Display only rights-admitted media.
- Preserve creator, source, licence, use scope, byte count, and checksum.
- Public replay must not expose restricted source collections.
- Research-only and owner-unknown reference media remain metadata-only unless a
  later rights decision permits display.
- A physical checksum proves byte identity, not taxonomic truth.

## Release vocabulary

Keep distinct:

```text
candidate evidence
model evidence
human-reviewed evidence
quality estimate
release-ready occurrence candidate
published occurrence
```

TaxaLens cannot create a published occurrence by itself.
