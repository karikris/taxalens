# TaxaLens verification workflow completion report

## Outcome and identity

TaxaLens now provides a first-class, campaign-driven Verification workflow for
Flickr hypotheses and GBIF/iNaturalist reference candidates. It can display
rights-admitted, checksum-verified media; record Yes, No, Can’t tell, Can’t
view, Skip, comments and structured corrections; retain append-only reviewer
events; project consensus and conflicts; export BioMiner-compatible decisions
and reviewed labels; calculate quality only for valid sampling designs; and
give a bounded stored GPT-5.6 recommendation for the next review action.

The workflow implementation and Phase 14.1 release gate are complete and
pushed. Scientific review work is not complete: the repository contains zero
retained human outcomes across its 82 campaign assignments.

| Identity | Value |
| --- | --- |
| TaxaLens starting SHA | `d728618fc2506054c71e726f943a845cdd2f61eb` |
| Ending implementation SHA | `94158393c9d3886143b432ecc4fbc5f783829c3b` |
| Remote `main` after Task 14.1 | `94158393c9d3886143b432ecc4fbc5f783829c3b` |
| Hosted URL | <https://karikris.github.io/taxalens/> |
| Hosted fingerprint | `02d5a288cb2aad0e37efef2b50c305480846266c0a3df117e9b294dfa03a1861` |
| Hosted source verified | `94158393c9d3886143b432ecc4fbc5f783829c3b` |
| Required branch | `main`; no feature branch or pull request |
| Primary model | `gpt-5.6-sol` |
| Reasoning effort used | `xhigh` |
| Codex session | `019f65d0-3ca9-7870-9eb2-37c14ed02517` |

## BioMiner evidence boundary

Two BioMiner revisions have distinct, non-interchangeable roles:

| SHA | TaxaLens use |
| --- | --- |
| `74a7d648a562efa744e6502ef504a23b63b4e02f` | Immutable judge-bundle evidence pin; all allowlisted imported bytes remain commit-qualified and checksum-verified |
| `94fa1f634ee3c63917c05d78181dd3cf9ceff940` | Current BioMiner implementation and campaign-planning context, including the 81-row user-confirmed prototype-role suitability receipt and the no-fixed-local-image-cap setting |

The newer BioMiner checkout is explicitly acknowledged without silently
rewriting the older evidence pin. Its 81 of 81 confirmation means that each
frozen provider-supported row is suitable for its assigned Build Week
prototype role. It does **not** mean independent human taxonomic verification,
classification accuracy, reference readiness or scientific release. BioMiner
remains the authority for reference resolution and scientific evaluation;
TaxaLens owns the review workflow and evidence presentation.

BioMiner itself was not modified by this goal. Its unrelated untracked local
files remain outside the TaxaLens boundary.

## Task and commit completion

The roadmap defines 15 phases, 41 tasks and 130 subtasks. Through the Phase
14.1 push, 40 tasks and 127 subtasks are complete. Their implementation is 132
direct-to-main commits after the starting SHA. Phase 14.2 adds the final report
and provenance commits without rewriting those implementation commits.

| Phase | First commit | Last implementation commit | Commits |
| ---: | --- | --- | ---: |
| 0 | `303a31b` | `d0b2b50` | 6 |
| 1 | `193d695` | `a5ba6e8` | 11 |
| 2 | `85dd7f9` | `4aad83e` | 14 |
| 3 | `5d16b8d` | `5cc6ce2` | 8 |
| 4 | `0dc8525` | `1fec3b9` | 4 |
| 5 | `97820cd` | `645e0c4` | 9 |
| 6 | `83b7a2f` | `e798205` | 9 |
| 7 | `759a9b9` | `435dc7b` | 6 |
| 8 | `9aafea8` | `b02984b` | 16 |
| 9 | `ba7e7c5` | `d175898` | 9 |
| 10 | `17aa1ed` | `08936b7` | 7 |
| 11 | `ff18832` | `17fe1e1` | 9 |
| 12 | `a9f3b53` | `873beb6` | 6 |
| 13 | `f50a501` | `e55bd96` | 15 |
| 14.1 | `a800ac5` | `9415839` | 3 |

Every commit carries the primary model, reasoning, session, origin, GitHits,
human-decision, reviewer and test trailers. Every completed task group was
pushed to remote `main`; no force push occurred.

<details>
<summary>Complete 132-commit implementation index</summary>

```text
303a31b docs(review): audit current verification implementation
3305121 docs(review): audit BioMiner verification contracts
2a6e649 fix(provenance): verify pinned BioMiner Git objects
dff3657 fix(provenance): allow retained BioMiner evidence pins
cca7e2b docs(architecture): define verification workflow
d0b2b50 docs(provenance): freeze verification boundaries
193d695 fix(review): require verified media for scientific decisions
47eae7a fix(review): gate verification controls by media state
9dea7a1 test(review): enforce media-before-decision rule
9999815 refactor(review): centralize verified media reads
a93c819 fix(review): revalidate existing cached media
57c5c72 fix(review): verify media again before display
8642485 test(review): cover corrupted media cache
a044668 fix(review): make media preparation cancellable
62613f0 fix(review): surface cache-clear failures
e90edb6 fix(review): handle browser persistence failures
a5ba6e8 test(review): cover review lifecycle failures
85dd7f9 feat(verification): define verification campaigns
23d72be feat(verification): define verification items
9b94891 refactor(review): express Commons packet as campaign
6634282 feat(verification): define append-only review events
2e8d84c refactor(review): preserve decision revision history
937c5ca fix(review): bind reviewer to immutable event
ced2785 test(review): cover append-only event history
cc660cf feat(verification): define review repository interface
3ab9efc test(verification): add in-memory review repository
056364e feat(verification): persist review ledger in IndexedDB
3158392 feat(verification): migrate legacy local review sessions
740b948 refactor(review): separate verification domain services
49c76b8 refactor(review): split verification workspace components
4aad83e refactor(review): model verification workflow states
5d16b8d feat(navigation): rename Human Review to Verification
0b706ce feat(verification): add verification workspace sections
a6c7c66 docs(tour): center verification in judge journey
450b3b9 feat(routing): add verification campaign deep links
dcc336f feat(evidence): link candidate records to verification
4425b13 feat(dashboard): link work items to verification
51deec6 feat(evidence): surface human verification in lineage
5cc6ce2 test(e2e): cover verification return journey
0dc8525 feat(bundle): add verification artifact sections
d23348e feat(rights): register verification media assets
a12af88 refactor(review): use one verification media manifest
1fec3b9 test(bundle): verify verification media integrity
97820cd feat(verification): adapt BioMiner reference review queues
f8be680 feat(verification): expose reference source provenance
2ceab3c test(verification): validate reference queue adapters
868bcef feat(verification): filter reference review campaigns
8fa883c feat(verification): add structured reference review controls
2dd0891 feat(verification): show reference review context
ec7fa2c feat(verification): export BioMiner reference decisions
631c95a test(verification): validate reference decision round trip
645e0c4 feat(verification): export reference review handoff
83b7a2f feat(verification): define Flickr review campaign inputs
207c5c0 feat(verification): build Flickr audit review queue
9ced910 feat(verification): build Flickr failure-discovery queue
f0d67a7 feat(verification): add blind Flickr review mode
9ff7f52 feat(verification): reveal model evidence after review
fc9c068 feat(verification): capture non-target Flickr outcomes
3b710bd feat(verification): export Flickr reviewed labels v2
6ec8bb0 feat(verification): bind sampling provenance to labels
e798205 test(verification): validate reviewed-label exports
759a9b9 feat(verification): define review consensus
d434591 feat(verification): resolve review consensus
41c2a9c test(verification): cover consensus and conflicts
fc1935c feat(verification): add conflict review queue
313e0e9 feat(verification): add review adjudication
435dc7b feat(verification): visualize review history
9aafea8 feat(quality): calculate review coverage
f155555 fix(quality): separate decisive and non-decisive review progress
2c6acec test(quality): validate review coverage metrics
ff8a037 feat(quality): estimate simple-random target precision
955bfdd feat(quality): estimate stratified target precision
64237a6 feat(quality): bootstrap grouped confidence intervals
7a26851 test(quality): cover target-quality estimators
4d231a4 feat(quality): calculate reviewer agreement
da45360 feat(quality): calculate robust reviewer agreement
cdcf533 feat(quality): evaluate reviewer control items
6c0b931 feat(quality): define verification release policy
b9b7838 feat(quality): enforce review evaluation milestones
464b57e feat(quality): persist verification quality snapshots
8d331ba feat(quality): show Flickr verification quality
31fcd6a feat(quality): show reference-bank quality
b02984b feat(quality): show reviewer reliability
ba7e7c5 feat(storage): add verification database schema
f21da01 feat(storage): enforce immutable verification ledger
320561e feat(storage): add verification row-level security
6d48569 feat(verification): persist reviews in Supabase
9e67a6f feat(verification): sync offline review events
98c3859 fix(verification): make review sync idempotent
8fbd065 feat(media): add rights-gated verification previews
9bf9665 perf(media): bound verification media cache
d175898 test(media): preserve credential-free verification replay
17aa1ed feat(agent): add verification evidence tools
439695e feat(agent): cite verification artifacts
1a7d752 test(agent): cover verification tools
f8608b7 feat(agent): recommend next verification action
88ff804 feat(agent): explain verification quality changes
bd2cb30 feat(agent): analyse verification campaigns
08936b7 test(agent): evaluate verification analyst
ff18832 refactor(contracts): add explicit evidence availability
d9d1456 refactor(verification): use explicit evidence states
0e754c1 test(contracts): validate evidence availability states
54dd4a1 feat(contracts): add verification JSON schemas
b8ade8b test(contracts): enforce cross-language verification parity
719d164 test(bundle): validate verification exports against schemas
4c68f4b docs(replay): document BioMiner compatibility boundary
8de13eb style: clean TaxaLens-native Python lint
17fe1e1 ci: enforce native TaxaLens lint cleanliness
a9f3b53 test(e2e): cover complete verification journey
58b91e9 test(e2e): add cross-browser verification smoke
a86f68c test(e2e): cover restricted browser states
9256467 test(visual): add verification snapshots
7a38c67 test(visual): protect judge-resolution layouts
873beb6 test(visual): protect accessible motion states
f50a501 data(verification): define Flickr audit campaign
adb202a data(verification): define reference audit campaign
7445e46 data(verification): define reviewer control campaign
53f1b52 feat(impact): capture manual verification baseline
f62ac13 feat(impact): measure assisted verification workflow
a9ac427 docs(impact): report verification productivity
6a1e74a feat(dashboard): integrate verification quality
721294d feat(evidence): integrate verification outcomes
41ae5be feat(mission): plan verification work
4f09edd fix(verification): keep routed review actionable
8e37b8e docs: add TaxaLens verification preview
a7b32f5 feat(agent): show next verification action
bc66563 docs: update verification judge route
6ae5879 docs: update winning presentation
e55bd96 docs(video): script verification-centered demo
a800ac5 chore(release): run complete verification gate
4ce799c test(release): verify scientific review semantics
9415839 chore(release): verify hosted verification replay
```

</details>

## GitHits and external-code review

Every task and subtask has its own JSONL record with queries, repositories
reviewed, adopted and rejected patterns, a reason, licence notes and service
status. Five supplementary records document extra gate fixes or model-display
work. GitHits became unavailable during the later phases; those records
explicitly say so rather than inventing a solution ID. No external
implementation was copied without review.

The Phase 14.2 task-level search covers research-software release reports and
competition provenance summaries. The report subtask separately covers
artifact-backed completion reports, review-count disclosure and exact blocked
claims.

## Campaigns and retained review state

| Campaign | Design and purpose | Assignments | Retained human outcomes | Current status |
| --- | --- | ---: | ---: | --- |
| Commons credential-free fixture | Fixed, non-representative workflow fixture | 3 | 0 | Active and public; quality estimation prohibited |
| Flickr audit | Blind stratified-random owner-group quality audit; 49 selected from 145 owner-canonical hypotheses | 49 | 0 | Packet ready; no reviewed-label import |
| GBIF/iNaturalist reference audit | Seeded targeted-priority readiness sample; 24 selected from 83,300 candidates | 24 | 0 | Packet ready; 0 independently reviewed |
| Reviewer controls | Six fixed workflow controls; three score-compatible procedural truths | 6 | 0 | Packet ready; no reviewer attempt or score |
| **Total** | Four campaign artifacts | **82** | **0** | No scientific review result |

The hosted gate created one disposable Can’t view event and one disposable Skip
event in a fresh local browser context, exported them, reset the replay and
discarded the context. The scripted impact protocol created disposable Yes
inputs. None is a retained human label and none is included in the table.

Flickr candidates remain hypotheses, not occurrences. The active
failure-discovery queue is targeted and explicitly ineligible for unweighted
quality estimation. The Flickr audit carries inclusion probabilities and
sampling weights, preserves owner, observation, duplicate, geography and
dataset-split bindings, and exports reviewed-label v2 only after real review.

The reference packet preserves provider source, route, life-stage, visual
domain, media, rights and request bindings and exports BioMiner-compatible
decision Parquet. Reference decisions may affect support readiness but cannot
enter final-test evaluation. The current readiness is 0 of 24 independent
outcomes, not 81 of 81.

## Consensus, conflict and evidence integrity

- Yes, No and Can’t tell require successfully opened, rehashed, byte-checked
  media. Can’t view and Skip remain available without a scientific visual
  judgment.
- Cache entries are revalidated during inspect, prepare and open. Preparation
  can be cancelled and stale completions are ignored.
- Review events are append-only and bind event, reviewer, round, media,
  question, campaign, TaxaLens and BioMiner identities. Revisions retain
  supersession lineage.
- Consensus separates decisive, uncertain, media-failure, deferred, pending,
  disagreement and adjudicated states. Skip is deferred, never decisive.
- Conflicts retain all dissent. Adjudication requires independent conflict
  lineage rather than overwriting a reviewer.
- IndexedDB is the credential-free durable repository. Optional Supabase sync
  retains the same event IDs and treats an identical remote event as an
  idempotent retry while rejecting conflicting reuse.

## Quality calculations and current result

The implementation provides:

- review, inspection and viewability coverage;
- simple-random Wilson intervals;
- stratified Hájek estimates with inclusion weights;
- owner/group-aware percentile bootstrap intervals;
- effective sample size;
- pairwise agreement and nominal Krippendorff alpha only when valid;
- reviewer-control accuracy and failure-handling diagnostics;
- reference-bank readiness;
- lower-confidence-bound release policy, minimum review requirements and
  scheduled evaluation milestones.

The current artifact-backed quality result is **Unavailable**. There are zero
retained decisive Flickr audit labels, no confidence interval, no effective
sample size, no valid reviewer overlap, no reference decision ledger, and no
completed leakage gate. The dashboard milestone is the first 20 decisive
Flickr audit outcomes; the release policy cannot be evaluated before that
evidence exists. The committed Wilson and weighted examples are calculation
test vectors, not observed TaxaLens quality.

## Optional cloud collaboration

Supabase support is implemented but not required by the judge replay. Four
ordered migrations create six verification tables, enforce append-only event
identity and revision rules, enable forced row-level security, grant only
assignment/role-scoped access, and align the event contract. The migrations
passed an in-process PostgreSQL behavioral verification. The browser adapter,
offline IndexedDB queue, reconnect drain and conflict-safe retry path are
tested. No live Supabase project, account, credential, production deployment or
remote human event was used or claimed.

Private Backblaze B2 delivery is also an optional tested contract, not a live
deployment. The browser accepts only short-lived authenticated preview
responses bound to an assigned item, expected digest, size, media type and
rights state. It prefetches current, next two and previous one with a bounded
LRU byte budget. No B2 credential, live bucket or private research media is in
the repository or public build. The hosted replay contains only the three
rights-cleared Commons files.

## GPT-5.6 analyst

The runtime analyst boundary has deterministic tools for campaign inspection,
next-action recommendation, quality-change explanation and campaign analysis.
The public demo replays a committed `gpt-5.6-sol` response through five actual
tool results and seven-artifact citations per result. It recommends
adjudication for an intentionally synthetic unresolved conflict, performs no
external action and authorizes no scientific claim.

The deterministic verification-agent evaluation passes 28 of 28 cases and
covers representative versus targeted sampling, missing intervals, unavailable
media, reference shortfalls, disagreement retention, no taxon guessing and
unsupported release rejection. The default run makes no live API call and does
not evaluate live model-output quality; it is not a BioMiner Phase 14
scientific evaluation. Codex was the build-time engineering agent, not the
runtime taxonomic decision-maker.

## Verification results

| Gate | Final result |
| --- | --- |
| Python | 765 passed |
| Vitest | 346 passed, 1 intentionally skipped |
| TypeScript | passed |
| Native Ruff | 104 files clean for check and format |
| Chromium | 46 passed, 1 intentionally skipped |
| Firefox smoke | 1 passed |
| WebKit smoke | 1 passed with temporary runner libraries; real browser executed |
| Hosted Chromium | passed in a fresh context at source `94158393…` |
| Visual regression | 16 committed snapshots; Chromium comparisons passed |
| Agent-focused tests | 9 passed; deterministic evaluation 28/28 |
| Supabase migrations | 4 migrations passed PostgreSQL behavioral validation |
| Demo/bundle | passed; 30 artifacts, 36 records and 3 media |
| Rights/attribution | passed; all 30 artifacts and 3 media covered |
| Static media | 4 passed |
| Static deployment | 3 passed; 67 fingerprinted files live |
| Provenance | passed |
| BioMiner boundary | passed with disclosed newer checkout/untracked-file warnings |
| npm audit | 0 vulnerabilities |
| Python lock | current; locked dev sync would make no changes |
| Secret scan | passed after review of 522 expected heuristic matches |
| Large-file scan | 0 files over 50 MiB |
| Repository whitespace | `git diff --check` passed |

The Chromium and WebKit runner libraries were supplied in temporary directories
because the host package registry lacked them. No repository or system package
was changed. WebKit's host-package validator was skipped after the libraries
were supplied; the WebKit browser itself launched and passed.

## Rights state

The judge bundle covers all 30 artifacts. The three public review images are
first-class bundle media with exact bytes, SHA-256, creator, source, licence and
use scope:

- Jeevan Jose, CC BY-SA 4.0;
- Sayan Sanyal, CC BY-SA 4.0;
- Bias Chakraborty, CC BY-SA 4.0.

Display and redistribution rights do not make their provider-supplied
taxonomic labels independently verified. Private Flickr and reference campaign
media are not exposed in the public artifact; restricted and research-only
rights remain private.

## Hosted replay

The authoritative post-Task-14.1 receipt is
`provenance/hosted_replay/hosted_replay_20260717T011100Z.json`. It verifies:

- public HTTPS root and no authentication challenge;
- no login/password UI, cookies, authorization or API-key headers;
- no cross-origin browser requests;
- reset to Mission;
- checksum-verified cache preparation;
- Can’t view and Skip handling;
- parsed v2 receipt export;
- all three media against both campaign and deployment digests;
- expected 404 fallback to `/taxalens/`;
- self-consistent deployment fingerprint at exact source `94158393…`.

## Measured impact

One frozen three-item scripted Chromium pair required 20 logged actions in the
manual fixture and 10 in TaxaLens, a 50% reduction in scripted interaction
count. Pages opened fell from four to one and fields from ten to four. The
assisted run was slower in that one automation run: 2,752 ms versus 753 ms.
There were zero human participants. This is not a human productivity,
time-savings, population-savings or scientific-quality result.

## Claims allowed and blocked

Allowed:

- TaxaLens implements and tests the stated review, provenance, quality and
  export workflow.
- The public three-image replay is rights-covered, checksum-bound,
  credential-free and resettable.
- The Flickr audit is a reproducible weighted sampling packet and the reference
  audit is a reproducible targeted readiness packet.
- BioMiner confirms 81 of 81 rows for their assigned prototype support roles.
- The frozen scripted protocol used 10 TaxaLens actions versus 20 manual
  actions.

Exactly blocked:

- “This candidate is a verified *Papilio demoleus* occurrence.”
- “The model classified the image correctly” or any accuracy, precision,
  recall, PR-AUC, calibration or selective-coverage result.
- “The raw YOLOE/BioCLIP/prototype score is a probability.”
- “The 81 BioMiner role-suitable rows are independently taxonomically
  verified.”
- “The reference bank is ready” or “24 reference labels were reviewed.”
- “The 49 Flickr audit items establish population quality.”
- Any estimate from the targeted failure-discovery or reference queue without
  the required weights/design.
- Any population prevalence inference from staged candidates.
- “More review clicks guarantee quality.”
- Any human productivity or time-savings claim from the scripted pair.
- “GPT-5.6 identified the species,” “live GPT quality was evaluated,” or “the
  agent authorized scientific release.”
- “Supabase/B2 production collaboration is deployed.”
- “Scientific release is authorized.”

## Human work remaining and next action

Qualified independent reviewers must review the private 49-item Flickr audit
and 24-item reference packet under the declared grouping, blinding and
assignment rules. Reviewer controls should be completed first. The immediate
recommended action is to import at least 20 decisive, inclusion-weighted Flickr
audit outcomes with stable reviewer identities and no split leakage, then
compute the first scheduled quality snapshot. Reference decisions must remain
support-only and separately advance the 0-of-24 readiness ledger.
