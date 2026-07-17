# Repository storage mirror

This directory materializes the TaxaLens cloud boundary as deterministic,
credential-free repository files.

- `supabase/` contains one application-readable snapshot for each of the six
  verification tables. Four campaigns and 82 items are present. Assignments,
  events, cached consensus rows, and quality snapshots are empty because no
  real shared reviewer identity or retained human outcome exists.
- `backblaze_b2/object_manifest.json` content-addresses every immutable file
  already committed under `demo/source/` and
  `demo/fixture/papilio_pilot/`. The repository paths are the object bytes;
  they are not duplicated under this directory.
- `backblaze_b2/external_source_media.json` retains the checksum, byte count,
  source, licence, and attribution metadata for the 49 Flickr and 24
  GBIF/iNaturalist review candidates whose source-image collections are not
  committed. Only the three rights-cleared Commons images are bundled for the
  public replay.

No Supabase user IDs, server timestamps, credentials, signed URLs, private
media collections, or scientific outcomes are fabricated. The production
Supabase migrations and Backblaze S3-compatible preview adapter remain
available, but the judge path can inspect all repository-permitted state
without either service.

The Supabase item projection normalizes `targetTaxon` to the campaign question,
as required by the production row adapter. Reference and competitor identities
remain in `providerSuppliedIdentity`, and the original campaign packet remains
unchanged and checksum-addressed by the B2 object manifest.

Regenerate and verify the mirror with:

```bash
uv run --locked python scripts/build_repository_storage.py
uv run --locked python scripts/build_repository_storage.py --check
```

The Supabase snapshots are decoded through the production row adapters in the
frontend tests. The B2 manifest verifier re-hashes every referenced file and
requires safe relative object keys.
