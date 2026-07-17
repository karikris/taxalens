# Judge bundle v2

Status: accepted

Date: 2026-07-17

## Decision

`taxalens-judge-bundle:v2.0.0` is the current TaxaLens judge-bundle contract.
The frozen v1 JSON Schema remains available as
`packages/contracts/schema/judge_bundle_v1.schema.json` for validation and
migration tests.

V2 requires the complete v1 section set plus these sections:

- `baseline_geographic_spread`;
- `baseline_provider_union`;
- `flickr_geography`;
- `geographic_impact_cells`;
- `geographic_impact_summary`;
- `country_hierarchy`.

The schema version is a semantic major version because omitting those sections
is no longer valid. A bundle without a committed geographic artifact must keep
the section and declare it `unavailable`, with no artifact IDs, a non-empty
reason, unavailable verification, required human review and scientific claims
disabled.

## Compatibility boundary

The current product contract is v2. V1 remains a supported input only through
the explicit v1-to-v2 migration boundary. Downstream product components receive
the canonical v2 shape and do not maintain separate v1 branches.

Migration must preserve the v1 bundle ID, creation time, target, source
revisions, artifact inventory, legacy sections, rights, attribution, stored
OpenAI replay, UI counts for legacy sections and checksum identities. It may add
only explicit unavailable geographic sections and zero UI counts when the v1
bundle supplies no geographic-impact artifacts.

Migration must not:

- invent baseline occurrence evidence;
- infer a direct iNaturalist delta;
- create reviewed or release-ready outcomes;
- reinterpret `geographic_clusters` as Geographic Impact evidence;
- change artifact bytes, checksums, rights or attribution;
- call an external service.

The public v1 fixture is migrated in memory when loaded. Its stored manifest and
payload files remain immutable until a separately verified v2 fixture is
materialized.
