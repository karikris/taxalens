# Current Verification code audit

## Audit identity

- Audit date: 2026-07-16 (Australia/Sydney)
- TaxaLens starting commit: `d728618fc2506054c71e726f943a845cdd2f61eb`
- TaxaLens remote `main`: `d728618fc2506054c71e726f943a845cdd2f61eb`
- BioMiner checkout commit: `94fa1f634ee3c63917c05d78181dd3cf9ceff940`
- BioMiner artifact commit pinned by the judge bundle:
  `74a7d648a562efa744e6502ef504a23b63b4e02f`
- Hosted replay fingerprint:
  `d728618fc2506054c71e726f943a845cdd2f61eb`
- Current public review route: `#human-review`
- Current review packet: `papilio-demoleus-commons-review-v1`
- Current review media: three checksum-verified Wikimedia Commons JPEGs

The explicit user instruction for this goal overrides the branch rule in
`AGENTS.md`: work is committed directly to `main`, no feature branch or pull
request is created, and `main` is pushed after each completed task. The
workspace already contained an unrelated modified
`submission/AI_CODE_PROVENANCE_REPORT.md` and an untracked
`TaxaLens-AGENTS.md:Zone.Identifier`; neither belongs to this audit and neither
may be staged.

## Files inspected

- `apps/web/src/review/reviewPacket.ts`
- `apps/web/src/review/reviewStore.ts`
- `apps/web/src/review/HumanReviewWorkspace.tsx`
- `apps/web/src/review/review.css`
- `apps/web/src/App.tsx`
- `apps/web/src/shell/shellTypes.ts`
- `apps/web/src/shell/GuidedTour.tsx`
- `apps/web/src/evidence/EvidenceLensWorkspace.tsx`
- `apps/web/src/dashboard/ReviewPriorityWorklist.tsx`
- `apps/web/src/data/evidenceFacade.ts`
- `packages/contracts/src/judge_bundle_contract.ts`
- `apps/web/src/review/reviewStore.test.ts`
- `apps/web/src/review/HumanReviewWorkspace.test.tsx`
- `apps/web/e2e/shell.spec.ts`
- `apps/web/scripts/verify-review-assets.mjs`
- committed judge-bundle rights, attribution, and deployment manifests

## Existing behavior worth preserving

- The public replay remains credential-free and does not download review media
  at application bootstrap.
- Downloaded review media is checked for exact byte count and SHA-256 before it
  is first cached.
- Persistent Cache Storage has an in-memory fallback.
- Object URLs are revoked when the displayed item changes or the component
  unmounts.
- The UI already distinguishes Yes, No, Can’t tell, Can’t view, and Skip.
- Comments and reviewer aliases are optional.
- Can’t view is described as a media problem and Skip as a deferral.
- The three media files have explicit creator, source, licence, byte-count, and
  SHA-256 metadata in the packet.
- The BioMiner boundary is truthful: 81/81 provider-support role attestations
  do not become independent taxonomic verifications.

## Hard-coded assumptions

`reviewPacket.ts` is a product-global Papilio-specific object rather than a
campaign fixture:

- packet ID and schema are literal types;
- the only taxon is *Papilio demoleus* / `gbif:1938069`;
- every item is an adult, live-field JPEG;
- supported views are only dorsal and ventral;
- every asset uses CC BY-SA 4.0;
- asset paths, hashes, sizes, labels, creators, and rights are duplicated in
  TypeScript;
- the store, cache name, localStorage key, workspace, counts, and navigation
  import `HUMAN_REVIEW_PACKET` directly.

The workspace displays `replay.target.scientificName` beside a separate packet
target without a contract that proves the two targets match.

## Cache behavior and integrity gaps

### Inspect

Persistent Cache Storage entries are re-read and checked for byte count and
SHA-256. Invalid persistent entries are deleted. The in-memory fallback counts
key presence only and does not revalidate blob bytes, media type, or checksum.

### Prepare

An existing persistent response or in-memory blob is counted as cached without
revalidation. A corrupt entry can therefore make preparation report progress
or readiness even though `inspect` would have rejected it. Fresh downloads
verify byte count and SHA-256, but the response `Content-Type` is not checked;
the code creates a new blob with the expected type.

### Open

`open` reads a cached blob and creates an object URL without checking byte
count, SHA-256, or content type again. A cache mutation between inspect,
prepare, and open therefore does not fail closed.

### Lifecycle

- `AbortController` is local to `prepareCache` and cannot be cancelled by the
  user.
- Preparation is not aborted on unmount or campaign change.
- Stale completion callbacks can update current component state.
- Cache/storage availability is reduced to one boolean and persistence
  failures are not typed.
- Cache errors are campaign-wide strings rather than per-item failures.

## localStorage behavior

- Scientific review state is one JSON object in localStorage.
- JSON parse, schema, and read failures silently return an empty session.
- Save, remove, quota, serialization, and private-browser failures are not
  caught or shown.
- Reviewer identity lives at session level rather than on each decision.
- Changing the reviewer field changes the identity exported for all decisions.
- Unknown or old packet items are silently dropped while loading.
- There is no IndexedDB repository, event ledger, sync state, or migration
  record.

## Decision overwrite behavior

`withDecision` replaces `decisions[itemId]`. Revisit-and-change therefore
destroys the prior outcome, comment, and timestamp. The current state has no:

- immutable event ID;
- review round;
- superseded event link;
- reviewer ID per event;
- question, campaign, image, TaxaLens, or BioMiner fingerprint;
- inspection state or duration;
- structured correction fields;
- consensus or adjudication projection.

Yes, No, and Can’t tell can be clicked before any image is prepared, opened, or
checksum-verified for display. Can’t view and Skip correctly need no scientific
media judgment, but the current code does not enforce that distinction.

## Route and product limitations

- Hash routing accepts only exact top-level view IDs and has no query parsing.
- `#human-review` cannot select a campaign, item, return view, or tab.
- Human Review is one monolithic screen, not a first-class Verification
  section.
- Flickr Results, Reference Images, Conflicts, and Quality do not exist.
- Evidence Lens has no “Verify this result” action.
- Dashboard review work has no campaign/item deep link.
- Review decisions do not return to the Evidence Ledger.
- `HumanReviewWorkspace.tsx` combines persistence, cache lifecycle, navigation,
  decision policy, progress, export, and presentation in one 445-line module.

## Rights-manifest limitations

The three public review images are emitted by the web build and appear in the
deployment fingerprint, but they are not judge-bundle artifacts:

- `artifact_inventory` contains no review JPEG;
- bundle `rights.items` and `attribution.entries` contain only MIT metadata;
- the rights manifest states `included_image_count: 0`,
  `licensed_image_count: 0`, and `media_asset_count: 0`;
- `verify-review-assets.mjs` duplicates sizes and hashes from
  `reviewPacket.ts`;
- creator, source title, source URL, licence, licence URI, and use scope are not
  verified through one authoritative media manifest.

The web assets have credible attribution in the UI, but bundle-level rights and
artifact completeness cannot currently prove it.

## Progress and statistical gaps

The progress label and exported `recorded` count include:

- decisive Yes/No outcomes;
- uncertain Can’t tell outcomes;
- technical Can’t view failures;
- deferred Skip outcomes.

This conflates attempted, inspected, decisively reviewed, uncertain, failed,
and deferred work. Skipped records are counted as recorded even though they
must not count as reviewed coverage.

There is no contract or calculation for:

- eligible population;
- independent reviewer count;
- duplicate, observation, owner, or photographer groups;
- sampling strata or inclusion probability;
- audit versus failure-discovery purpose;
- viewability;
- consensus or conflict rate;
- precision estimate or confidence interval;
- effective sample size;
- reviewer agreement;
- release-quality policy.

The three-image convenience campaign has no sampling design and cannot support
a population-quality estimate.

## Test gaps

The current tests prove the happy path but leave the integrity boundary largely
untested:

- `reviewStore.test.ts` only round-trips one localStorage decision.
- Component tests use a fake cache and intentionally assert overwrite
  semantics.
- No test prevents Yes, No, or Can’t tell before media display.
- No test covers corrupt persistent or memory cache entries.
- No test covers byte-count, SHA-256, or media-type failure during open.
- No test covers cancellation, unmount, stale completion, clear failure,
  quota failure, unavailable storage, or serialization failure.
- E2E covers the three-image route and non-binary controls only.
- No route, campaign, repository, event-history, consensus, conflict, quality,
  rights-manifest, or BioMiner export journey exists to test.

## Baseline verification

- `uv run pytest -q`: **668 passed, 3 failed**.
- `npm test -- --run`: **51 files passed, 114 tests passed**.
- `uv run python scripts/verify_demo.py`: passed with bundle
  `papilio-demoleus-prototype-74a7d648-v3`, 25 artifacts, 29 records, zero
  media, and hero state `awaiting_human_review`.
- `uv run python scripts/verify_provenance.py`: passed.
- Public deployment fingerprint: matches TaxaLens
  `d728618fc2506054c71e726f943a845cdd2f61eb`.

All three Python failures arise before their intended assertions because
`scripts/import_biominer_prototype_artifacts.py` requires the BioMiner working
checkout `HEAD` to equal the pinned artifact commit. BioMiner `main` has
legitimately advanced to `94fa1f6` while the exact committed source objects at
`74a7d648` remain available. This couples artifact verification to checkout
position and must be repaired as a separate integrity subtask; the audit does
not conceal or bypass it.

Follow-up subtask `verification-0.1.3` removes that moving-`HEAD` coupling. The
importer now verifies that the exact pinned revision resolves to a commit and
continues to read every allowlisted path through
`git show <pinned-commit>:<path>`, followed by the existing byte-count,
SHA-256, schema, and imported-byte comparisons. Advancing BioMiner `main` no
longer invalidates immutable artifacts from an earlier retained commit.

Follow-up subtask `verification-0.1.4` applies the same rule to the BioMiner
boundary verifier. A missing or differently resolved pin remains fatal.
An available pin with a newer checkout `HEAD` is recorded as explicit
provenance metadata and a warning, not misclassified as an integrity failure.

## Required direction

The next implementation must:

1. gate scientific outcomes on verified media display;
2. centralize fail-closed media reads across inspect, prepare, and open;
3. make cache and persistence operations cancellable and observable;
4. introduce generic campaigns, immutable events, and a repository boundary;
5. convert the Commons packet into a rights-bound campaign fixture;
6. keep Flickr, reference, conflict, and quality workflows distinct;
7. separate coverage from statistically valid quality estimation.
