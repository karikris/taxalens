# Geographic Impact Lens and Verification

## Accepted ADRs

Read before changing these areas:

```text
docs/architecture/geographic-impact-lens.md
docs/architecture/baseline-provider-union.md
docs/architecture/verification-workflow.md
HUMAN_DECISIONS.md
```

## Workspaces remain separate

### Flickr Workload Map

Operational view:

- candidate clusters;
- dispersion;
- outliers;
- processing workload.

It does not calculate occurrence contribution.

### Geographic Impact Lens

Artifact-first evidence comparison:

- one baseline provider-union snapshot;
- one precision-aware Flickr snapshot;
- optional review, quality, and release projections;
- global → continent → country → admin1 drilldown;
- exact scoped table and accessible map.

Do not merge the two semantics.

## Canonical geographic framing

The public replay, stored analyst replay, judge route, README capture, hosted
verification, and release report use **Global** as their canonical scope. They
must not hard-code a named country, ISO country code, regional cell, or
candidate record as the project's representative geographic story.

Administrative drilldown remains an optional analytical capability. Browser
tests exercise it by selecting deterministic values from the checksum-verified
hierarchy rendered by the application. Isolated unit and schema tests may use
clearly synthetic scope identities. A real named country may appear only when
it is read from an artifact in response to a researcher selection; its presence
does not establish an occurrence or biological range.

## Geographic identity

Every read is scoped by:

```text
project_id
run_id
accepted_taxon_key
registry_version
baseline_snapshot_id
flickr_snapshot_id
grid_name
grid_version
spatial_resolution
```

Unknown or incompatible identity fails closed.

Initial grid contract uses H3 resolutions 3, 5, and 7. These are artifact
identity, not universal constants.

Flickr coordinate precision controls the finest supported cell. Roll fine cells
up when needed; never infer a fine child from coarse coordinates.

## Geographic evidence states

Product vocabulary:

| State | Meaning |
|---|---|
| Baseline occurrence evidence | deduplicated, eligible selected-baseline observations |
| Flickr candidate evidence | source candidate, identity unverified |
| Potential coverage-gap cell | candidates present, eligible baseline count zero |
| Human-supported additional cell | decisive target-positive review, baseline count zero |
| Release-ready additional cell | record-level release gates pass, baseline count zero |
| Data-deficient baseline | baseline insufficient for requested inference |
| Candidate range extension | maturity-qualified nearest-baseline evidence, not a biological boundary |

Blue represents baseline evidence. Amber represents Flickr maturity. Shape,
fill, dash, stroke, legend, text, and table must carry meaning in addition to
color.

## Contribution calculations

Candidate-only:

```text
eligible baseline count = 0
AND Flickr candidate count > 0
```

Human-supported:

```text
eligible baseline count = 0
AND reviewed target-positive count > 0
```

Release-ready:

```text
eligible baseline count = 0
AND release-ready occurrence-candidate count > 0
```

Calculate uplift tiers separately. A zero or unavailable baseline denominator
makes percentage uplift unavailable.

Nearest-baseline distance:

- same target and compatible resolution;
- geodesic/cell-centroid method recorded;
- method and cells persisted;
- unavailable when comparison cannot be verified.

Temporal contribution:

- exact source dates only;
- date precision and signed interval retained;
- missing Flickr dates remain unavailable;
- never infer novelty from date alone.

Data-deficiency reasons are additive and evidence-derived. Do not invent policy
thresholds to make a map look complete.

## Bubble scale

One tested domain per selected scope for baseline and Flickr.

Default:

```text
sqrt_absolute
```

If a non-zero minimum radius is used, use the accepted caption:

> Bubble radius uses a square-root count scale; exact counts appear in the
> tooltip.

Do not claim exact area proportionality.

## Verification campaign kinds

Keep distinct:

```text
Flickr audit
Flickr failure discovery
reference identity
reference route/domain
conflict adjudication
quality control
Commons public fixture
```

Campaign fingerprint includes:

- target and source identity;
- question and disclosure policy;
- sampling plan;
- required independent reviews;
- media rights and hashes;
- TaxaLens and BioMiner revisions.

## Review lifecycle

1. Load campaign and item.
2. Prepare permitted media.
3. Verify byte count, SHA-256, and media type.
4. Display media.
5. Append outcome/comment/corrections.
6. Project current decision.
7. Resolve consensus or conflict.
8. Snapshot quality only at valid milestones.
9. Return review evidence to Evidence Lens.
10. Export deterministic BioMiner-compatible handoff.

No normal update/delete operation exists for review events.

## Blind Flickr review

Before decision, hide configured model-influencing context:

- BioCLIP result and margin;
- decision and strongest competitor;
- Flickr comments;
- source query term/trust tier;
- provider-supplied target identity.

After the event, reveal only the campaign-authorized context.

## Sampling and quality

Audit sample:

- probability design;
- inclusion probabilities;
- representative strata;
- independence groups;
- may support weighted population-quality estimates.

Failure-discovery sample:

- enriched for likely errors;
- may guide remediation;
- must not be used unweighted for population accuracy.

Quality snapshots record:

- campaign/sampling/event fingerprints;
- coverage and viewability;
- estimator/interval/confidence;
- effective sample size;
- represented/missing strata;
- reviewer agreement/conflicts when valid;
- release-policy results;
- TaxaLens/BioMiner revisions.

## Current active-goal next area

Committed main is through Geographic Impact Task 5.3.

The next planned phase is integration:

- join current Verification consensus and maturity into impact cells/views;
- expose assigned versus decisive/uncertain/media-failure/pending counts;
- update local reviewed layers from IndexedDB without creating release;
- add Evidence Lens mini-map and deep links;
- bind aggregate reviewed contribution to a valid `QualitySnapshot`;
- block unweighted claims from failure-discovery campaigns.

Inspect local uncommitted work before beginning any of these tasks.
