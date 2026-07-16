# BioMiner replay compatibility boundary

TaxaLens keeps a small source-locked compatibility layer so the offline replay can
interpret committed BioMiner artifacts without importing or running the BioMiner
application. This boundary is about source provenance, not trust: every imported
artifact and every compatibility projection still passes TaxaLens validation,
checksum, rights, and scientific-claim gates.

The machine-readable authority is
[`compatibility_boundary.json`](compatibility_boundary.json). A replay source file
is exempt from TaxaLens-native formatting only when its exact repository-relative
path is listed in `source_locked_files`. Everything else is TaxaLens-native,
including:

- all files under `taxalens/` and `tests/`;
- all files under `packages/replay/tests/`;
- `packages/replay/src/validation.py`;
- TaxaLens artifact adapters and compact extracted vocabularies under
  `packages/replay/src/` that are not listed in the manifest.

## Source-locked modes

`copied` means the BioMiner implementation is retained without semantic changes.
`complete_source_adaptation` means the complete upstream implementation is retained
and only internal imports or packaging references target the preserved TaxaLens
copies. Both modes are source-locked. They are not a general compatibility dumping
ground, and their current lint findings are not a baseline for new TaxaLens code.

The locked files retain an exact BioMiner source path and commit in their file
headers and in the boundary manifest. The current set covers detector contracts and
routing, target-aware decision and score contracts, full-frame processing, evidence
review and visual gates, semantic hashing, and Parquet storage compatibility.

## Change policy

Do not run repository-wide automatic formatting over source-locked files. Change one
only when a security fix, supported-runtime break, or required compatibility repair
cannot be implemented at a TaxaLens adapter boundary. Such a change must:

1. preserve or update the upstream repository, source path, and commit declaration;
2. explain the unavoidable semantic or compatibility delta in provenance;
3. add focused behavior tests;
4. prefer an upstream BioMiner fix followed by a deliberate re-import when feasible;
5. avoid mixing native lint cleanup into the compatibility change.

New TaxaLens code may not be added to the exemption list merely because it has lint
findings. Moving a file into or out of `source_locked_files` is a reviewed provenance
change and must pass the manifest validator.

## Lint reporting

The native lint gate is fail-closed and must remain clean. Compatibility findings
are reported separately and do not fail the native gate until an intentional
re-import or focused repair addresses them. The report must name the locked file and
Ruff rule; it must never hide findings by applying a blanket repository exclusion.

This separation permits incremental cleanup without rewriting source-pinned behavior
or implying that mechanically restyled code still matches its declared upstream
commit byte-for-byte.
