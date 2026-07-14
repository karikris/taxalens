# UPSTREAM_BIOMINER.md

## Upstream engine summary

TaxaLens treats `karikris/BioMiner` as the upstream research engine and treats this repository as the product, replay, and evidence-observability layer.

## Migratable boundary

- BioMiner is the upstream contract source for evidence artifacts and workflow metadata.
- BioMiner Phase 12 has been pushed and can be selectively consumed when referenced by a committed SHA.
- Phase 12 migration must use committed, pushed SHAs only.
- BioMiner Phase 13 is currently active/in-progress and is excluded unless a commit is explicitly pinned and verified as committed.
- TaxaLens does not import staged, uncommitted, or locally modified BioMiner work.
- Adapters should prefer committed artifact contracts and stable interfaces before any code extraction.

## Pinned SHA

- `biominer_repository`: `karikris/BioMiner`
- `pinned_sha`: `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`
- `branch`: `main`

## Contracts consumed (current phase)

- No BioMiner contracts have been migrated yet in this phase.
- Future migrations should be implemented as contracts and adapters with source SHAs recorded per component.

## Excluded work

- Any staged/uncommitted BioMiner files and changes are excluded.
- Any unpinned or in-progress Phase 13 materials are excluded.

## Compatibility constraints

- Do not assume local BioMiner staging state in production mapping.
- All mapping must run from local fixture files and committed artifact outputs.
- No source-image collections, model weights, or credentials are to be committed into TaxaLens.
