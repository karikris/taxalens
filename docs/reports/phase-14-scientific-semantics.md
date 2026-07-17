# Phase 14.1.2 scientific review semantics

The release gate treats technical success and scientific authorization as
separate decisions. The following checks execute against the committed fixture
and the production review/evaluation functions.

| Required semantic | Executable release check | Result |
| --- | --- | --- |
| Candidates are not occurrences | Candidate sets, selective decisions and all bundle-section semantics are constrained to hypothesis, diagnostic, unavailable or unverified-support roles | passed |
| Prototype-role attestation is not taxonomic verification | The 81-of-81 BioMiner receipt must retain user goal-suitability semantics and `independent_human_taxonomic_verification_claimed: false` | passed |
| Raw scores are not probabilities | Evidence semantics, raw-margin policy and absent calibrator must all agree that no probability is emitted | passed |
| Skip is not reviewed | A real Skip event projects to deferred work, zero decisive items and one skipped event | passed |
| Active failure discovery is not used unweighted | The production precision estimator rejects failure-discovery purpose, targeted design, non-representative selection and disabled quality estimation | passed |
| Unavailable metrics are not displayed as results | All seven evaluation metrics remain non-numeric `Unavailable` states | passed |
| Reference decisions do not leak into final evaluation | Injecting an out-of-boundary reference-decision ledger leaves the evaluation model and evaluation-export digest unchanged | passed |
| The configured target remains scoreable | Production target-aware output accepts exactly one configured target with score evidence and rejects a competitor-only union | passed |
| Failed gates block scientific release | Both a broadened scientific-release flag and raw-score probability drift produce `NO_GO`, no prototype authorization and no scientific claim | passed |

The role-suitability check consumes BioMiner evidence at
`94fa1f634ee3c63917c05d78181dd3cf9ceff940` as current implementation context.
The immutable evidence inside the judge bundle remains pinned to
`74a7d648a562efa744e6502ef504a23b63b4e02f`; the newer checkout does not silently
rewrite the evidence lineage.

These checks authorize only the credential-free prototype replay. They do not
authorize an occurrence claim, classification accuracy, calibrated probability,
population prevalence, independently verified reference bank or scientific
release.
