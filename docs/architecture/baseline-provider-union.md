# Baseline provider-union policy

Status: accepted

Decision date: 2026-07-17

Policy version: `baseline-provider-union-policy-v1.0.0`

Scope: canonical GBIF and direct iNaturalist occurrence evidence used by the
TaxaLens Geographic Impact Lens

## Context

GBIF includes observations whose original provider is iNaturalist. Adding all
GBIF rows to all rows from a direct iNaturalist snapshot would count many of
the same observations twice. Conversely, aggressive matching on a taxon, date,
or nearby coordinate can collapse independent observations and hide
scientific uncertainty.

The product requires one baseline occurrence count, a transparent provider
composition, and a reversible explanation of every duplicate decision. It
must also operate truthfully when no direct iNaturalist occurrence snapshot is
committed.

## Decision

TaxaLens will build a conservative, deterministic **baseline provider union**.
It preserves every input provider row, assigns exactly one canonical flag per
resolved observation, records every provider relationship, and retains
ambiguous duplicate candidates as separate canonical observations in an
unresolved group.

Probabilistic linkage may later propose review candidates, but no probability
or similarity threshold automatically removes an occurrence from the
baseline.

## Required identities

Every provider input row is immutable and includes:

- baseline snapshot ID;
- source artifact and row identity;
- provider delivery source;
- original provider when declared;
- provider observation ID;
- GBIF occurrence key, when present;
- iNaturalist observation ID, when present and verified;
- Darwin Core `occurrenceID`, including its namespace context;
- stable source reference, when present;
- dataset and publishing-organization identity;
- accepted taxon identity;
- observer/recorded-by identity, when available;
- event date and precision;
- coordinates, uncertainty, and generalization state;
- raw provider-record fingerprint;
- source snapshot and retrieval provenance.

Missing identifiers remain null. The builder does not invent provider IDs from
array position or display text.

## Provider and delivery vocabulary

Canonical provider class, underlying source dataset, and delivery path are
separate:

- `canonical_provider = gbif` means the observation belongs to the selected
  GBIF baseline and is not reliably classified as iNaturalist-origin; it does
  not claim that GBIF created the observation;
- `canonical_provider = inaturalist` means the source provenance reliably
  identifies iNaturalist origin, whether the row was obtained directly or
  delivered through GBIF;
- `delivery_provider = gbif` identifies a GBIF-delivered row;
- `delivery_provider = inaturalist` identifies a row in a committed direct
  iNaturalist snapshot.

The source dataset key, publisher, citation, and provider namespace remain
separate fields for every row.

The union never labels a GBIF-delivered iNaturalist observation as an
independent GBIF observation merely because the direct snapshot is absent.
Original-provider classification requires a committed, versioned mapping or
an unambiguous source field. An unrecognized dataset remains GBIF-only rather
than being guessed from a name fragment.

## Canonical observation ID

`canonical_observation_id` is a deterministic, namespaced SHA-256 identity over
the strongest accepted match basis and its normalized values:

```text
baseline-observation:v1:sha256:<digest>
```

The preimage version, match method, normalized identifiers, and contributing
provider-record fingerprints are recorded in the union manifest. Changing the
matching policy, normalization version, or accepted inputs creates a new union
fingerprint; historical IDs are not silently reinterpreted.

For an unresolved candidate pair, each provider row retains its own canonical
observation ID. The unresolved group is a separate identity over the sorted
member IDs.

## Deterministic matching hierarchy

Rules run in priority order. A weaker rule cannot override a contradiction in
a stronger identifier.

### 1. Exact provider observation identity

Rows link when normalized `(provider_namespace, provider_observation_id)` is
equal under the provider's declared identifier scope. This handles repeated
deliveries and within-provider duplicates without assuming that identically
formatted IDs from different providers share a namespace.

### 2. iNaturalist identity represented through GBIF

A GBIF row links to a direct iNaturalist row when both resolve to the same
verified iNaturalist observation ID. TaxaLens may resolve that ID only from:

- a dedicated committed field;
- a documented iNaturalist `occurrenceID` or stable observation reference;
- a recognized iNaturalist-origin GBIF dataset mapping plus a validated source
  observation identity.

An arbitrary number found in a URL, title, media path, or comment is not an
iNaturalist observation identity.

### 3. Scoped Darwin Core occurrence identity

Rows with the same non-empty `occurrenceID` link only when their original
provider, dataset/publisher namespace, or stable source relationship makes the
identifier scope compatible. A bare `occurrenceID` is not treated as globally
unique.

### 4. Stable source reference

Rows link on one documented stable source-record reference after conservative
normalization. Normalization may standardize scheme/host casing and remove
only provider-documented presentation or tracking parameters. It does not
collapse different observation paths, image IDs, or unrecognized query
parameters.

Resized-media URLs alone do not define an occurrence. Two media variants link
only through the same stable observation identity or source record.

### 5. Strict source/observer/taxon/date/location composite

A composite exact match is eligible only when all configured fields are
present, normalized, and non-contradictory:

- compatible provider namespace, source dataset, or publishing identity;
- observer identity;
- accepted taxon key;
- event date and compatible date precision;
- coordinates interpreted with uncertainty/generalization;
- country/admin context where available.

The composite must be one-to-one within its comparison block. Repeated visits,
bursts, multiple observation IDs, two observers, generalized coordinates, or
another plausible independent-observation pattern make the pair unresolved
instead of merged. Taxon, date, coordinate, observer, or media similarity alone
is insufficient.

### 6. Unresolved duplicate group

A plausible pair that lacks a safe deterministic link is placed in an
`unresolved_provider_duplicate_group`. Every member remains a separate
canonical observation and contributes to the conservative baseline union.

The group records:

- deterministic group ID;
- sorted provider-record and canonical-observation IDs;
- candidate rule and normalization version;
- agreements and contradictions by field;
- reason code;
- review state;
- creation artifact and fingerprint.

Resolving a group requires a new reviewed relationship artifact and a new
provider-union materialization. Existing source rows and prior manifests remain
unchanged.

## Contradiction rules

Automatic linking stops when authoritative fields conflict, including:

- different non-empty observation IDs in the same original-provider namespace;
- incompatible occurrence-ID namespaces;
- different accepted taxa without a committed taxon-resolution relationship;
- non-overlapping event dates after accounting for precision;
- coordinates incompatible after uncertainty/generalization is considered;
- conflicting observer identity;
- one-to-many or many-to-many match candidates under a rule declared
  one-to-one;
- a provider relationship that cannot be traced to committed source fields.

A conflict is evidence to retain rows, not an invitation to select the most
convenient value.

## Canonical representative policy

Canonical identity is separate from the representative row. The builder marks
one input row `canonical_flag=true` by this deterministic order:

1. a direct row from the identified source provider in the selected committed
   snapshot;
2. an aggregator-delivered row when no direct original-provider row exists;
3. the row with complete stable identity and source provenance;
4. stable lexical order of provider record identity as a final deterministic
   tie-breaker.

The representative is not constructed by silently cherry-picking the best
value from each provider. Any derived TaxaLens field records its source
relationship and derivation policy. A material coordinate or taxon
contradiction blocks range-inference eligibility until resolved.

## Provider relationships

Every canonical observation retains one or more relationship rows with:

- canonical observation ID;
- provider input-row identity;
- original and delivery provider;
- provider observation IDs;
- source dataset and snapshot;
- relationship kind;
- match method and priority;
- matched normalized values;
- canonical flag;
- exact-duplicate-removed flag;
- contradiction and unresolved-group identity;
- policy, builder, and artifact fingerprints.

Required relationship kinds include:

- `canonical_source`;
- `same_provider_repeat`;
- `inaturalist_via_gbif`;
- `direct_inaturalist_equivalent`;
- `scoped_occurrence_id_equivalent`;
- `stable_source_reference_equivalent`;
- `strict_composite_equivalent`;
- `unresolved_duplicate_candidate`.

The flat baseline union may project the representative fields, but it never
replaces the relationship artifact or nested relationship field required to
explain the canonicalization.

## Count semantics

All counts are derived from the same selected input set and policy fingerprint.

### Baseline union

`baseline_union_count` is the number of canonical observations after safe
deterministic links, including each unresolved member separately. The default
map further filters this count to range-inference-eligible observations.

### GBIF-only

`gbif_only_count` is the number of canonical observations whose original
provider is GBIF and which have no iNaturalist-origin relationship.

### iNaturalist-origin through GBIF

`inaturalist_origin_through_gbif_count` is the number of canonical observations
identified as iNaturalist-origin with at least one GBIF delivery relationship.
It is counted once whether or not a direct equivalent also exists.

### Direct iNaturalist delta

`direct_inaturalist_delta_count` is the number of direct iNaturalist canonical
observations not safely linked to a GBIF-delivered canonical observation.
Because unresolved potential duplicates are retained, the delta reports how
many of these rows participate in unresolved groups.

If no committed direct iNaturalist occurrence snapshot exists, this count and
its comparison are `unavailable`, not zero.

### Duplicates removed

`duplicates_removed_count` is the number of provider input rows linked as safe
equivalents beyond the single canonical flag for their observation. It
includes only deterministic relationships and is reconciled by:

```text
provider input row count
- duplicates removed count
= baseline union count
```

The manifest also reports within-provider and cross-provider removed counts.

### Unresolved provider duplicates

`unresolved_provider_duplicate_group_count` counts unresolved groups;
`unresolved_provider_duplicate_member_count` counts their retained canonical
members. No member is included in `duplicates_removed_count` unless a later
reviewed materialization safely resolves it.

For a GBIF plus optional direct-iNaturalist input set, canonical composition
reconciles as:

```text
baseline union count
= GBIF-only count
 + iNaturalist-origin through-GBIF count
 + direct iNaturalist delta count
```

The manifest fails when composition or input/duplicate reconciliation does not
hold.

## Range-inference and raw totals

Deduplication precedes range-inference filtering. The union records both the
canonical raw total and the canonical range-inference-eligible total.

One physical observation cannot become eligible twice through two providers.
Provider disagreement about coordinate, taxon, date, occurrence status, or
geospatial quality is retained. A material unresolved contradiction makes the
canonical observation ineligible rather than selecting the permissive
provider state.

## Direct iNaturalist unavailable state

TaxaLens does not fetch direct iNaturalist data to complete a provider chart.
When no exact committed direct snapshot is present:

- build the canonical union from GBIF-delivered evidence;
- identify iNaturalist-origin GBIF observations where committed provenance
  permits it;
- set direct iNaturalist artifact, row count, delta, and comparison status to
  unavailable with a reason;
- preserve source dataset and delivery relationships;
- do not present an inferred direct-provider comparison.

## Manifest and audit receipt

Every union publishes a deterministic manifest containing:

- policy and normalization versions;
- project, run, target, registry, and baseline snapshot IDs;
- exact input artifact paths, SHA-256 values, row counts, and source revisions;
- direct-provider availability;
- match counts by hierarchy rule;
- contradiction counts;
- canonical and provider composition counts;
- removed and unresolved duplicate counts;
- relationship and union artifact checksums;
- deterministic fingerprint;
- builder revision and test evidence.

No live provider request, mutable working-tree row, or model-memory judgment is
part of a provider-union build.

## Consequences

- GBIF and iNaturalist-origin observations delivered through GBIF are counted
  once.
- A direct iNaturalist snapshot can add a transparent delta without hiding its
  unresolved duplicate risk.
- Every removed row remains discoverable through provider relationships.
- Coincident independent observations remain separate unless strong identity
  evidence links them.
- The map, table, export, and GPT-5.6 tools can expose the same reconciled
  provider composition and unavailable states.

## Rejected alternatives

- `all GBIF rows + all direct iNaturalist rows`.
- Globally matching a bare Darwin Core `occurrenceID`.
- Merging on taxon and nearby coordinates alone.
- Automatic probabilistic linkage or a model-confidence threshold.
- Dropping ambiguous rows to make provider totals reconcile.
- Keeping only the canonical row and discarding provider relationships.
- Fetching a direct iNaturalist snapshot solely to fill a display.
- Treating missing baseline evidence as species absence.
