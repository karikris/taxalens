# Repository storage mirror report

Status: complete

Date: 2026-07-17

TaxaLens start SHA: `775940aac4dd1220fb709abb0c54b5270f97136b`

TaxaLens end SHA: the commit containing this report

BioMiner context SHA: `94fa1f634ee3c63917c05d78181dd3cf9ceff940`

AI session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`, OpenAI Codex,
`configured-model`, standard reasoning mode, `xhigh` reasoning effort, no supporting
model.

## Outcome

TaxaLens now commits a deterministic, credential-free mirror of every
repository-permitted file or row that the verification prototype would
otherwise address through Supabase or Backblaze B2.

- Six Supabase table snapshots contain four campaign rows and 82 queue-item
  rows. Assignment, event, consensus, and quality-snapshot tables are present
  as explicit empty snapshots because the repository contains no retained
  human outcomes or real Supabase Auth identities.
- The B2-style inventory content-addresses all 74 existing files under
  `demo/source/` and `demo/fixture/papilio_pilot/`, totalling 4,650,910 bytes.
  Repository paths are the object bytes, so the mirror does not duplicate
  them.
- A separate 73-item ledger retains declared checksum, byte-count, licence,
  attribution, provider, and source-URI metadata for 49 Flickr and 24
  GBIF/iNaturalist candidates.
- The source-image collections represented by that external ledger are not
  committed. This preserves the repository's public-rights boundary; the
  three existing rights-cleared Commons images remain the only public replay
  image bytes.

The snapshot generator normalizes a queue item's target taxon to its campaign
question before producing a Supabase row. It keeps the provider or competitor
identity in `providerSuppliedIdentity` and keeps the original source packet
unchanged in the B2 manifest. The production TypeScript row adapters verify
this projection.

## Security and database boundary

No service-role key, B2 application key, signed URL, private media collection,
Supabase user ID, or server timestamp was added. Existing Supabase migrations
retain explicit Data API grants and forced row-level security; the repository
snapshot is application-readable JSON and is not a seed that bypasses those
policies.

The mirror is not represented as a live cloud dump. It cannot contain remote
state that does not exist in committed artifacts, and it deliberately does not
fabricate reviewers, labels, adjudications, consensus, or scientific quality
results.

## Verification

- Repository generator check: passed; six tables, four campaigns, 82 items.
- Full Python suite: 769 passed, including four storage-mirror tests.
- Ruff lint and formatting: passed.
- Full frontend unit suite: 348 passed and one skipped across 110 passing and
  one skipped test files, including two production Supabase-row adapter tests.
- TypeScript strict check: passed.
- PostgreSQL migration verification: all four verification migrations passed.
- Truthful demo and provenance verification: passed.
- Every B2 manifest entry was re-hashed and checked for a safe relative object
  key.
- Targeted secret scan and repository-storage file-size audit: passed; the
  largest generated mirror file is 494,033 bytes.

## Competition and human-decision boundary

This work makes the storage boundary directly inspectable in a clone and
reduces judge dependence on third-party credentials or network availability.
It adds no human verification result and authorizes no scientific claim. The
human decision was to commit all repository-permitted cloud-shaped state while
retaining the existing rights, provenance, authentication, and zero-outcome
boundaries.
